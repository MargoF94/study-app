// Screenshots and other files attached to questions. Each file's record syncs with the rest
// of your data; its bytes are kept on this device (IndexedDB) and in the data repo, and are
// downloaded on other devices after a sync. Large images are shrunk before they are saved.
import * as db from './db';
import { asJpegName, extensionOf, fitWithin, isHeic, isImage, MAX_FILE_BYTES, MAX_IMAGE_SIDE, nameOf, SHRINK_OVER_BYTES, typeOf, formatBytes } from './files';
import { GitHubError, deleteFile, getBlobBytes, putBytes, type SyncConfig } from './github';
import { attachmentPath } from './merge';
import { store } from './store.svelte';
import { toasts } from './toast.svelte';
import type { Attachment, Question } from './types';
import { newId } from './util';

/** Decodes an image; big ones (and HEIC photos) come back as JPEG. Unreadable images are kept as they are. */
async function prepareImage(file: Blob, type: string): Promise<{ blob: Blob; type: string; width?: number; height?: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const small = file.size <= SHRINK_OVER_BYTES && Math.max(w, h) <= MAX_IMAGE_SIDE;
    // Animated GIFs would lose their animation.
    if (type === 'image/gif' || (small && !isHeic(type))) return { blob: file, type, width: w, height: h };
    const size = fitWithin(w, h, MAX_IMAGE_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, type, width: w, height: h };
    ctx.fillStyle = '#ffffff'; // JPEG has no transparency
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(img, 0, 0, size.width, size.height);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!jpeg || (jpeg.size >= file.size && !isHeic(type))) return { blob: file, type, width: w, height: h };
    return { blob: jpeg, type: 'image/jpeg', ...size };
  } catch {
    return { blob: file, type };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** How many ready-to-show files are kept at once (each holds on to its file). */
const KEEP_URLS = 80;

class Attachments {
  /** Ready-to-show addresses of files that are on this device, by attachment id. */
  urls = $state<Record<string, string>>({});
  /** Files not on this device yet (waiting for a sync or a connection). */
  missing = $state<Record<string, boolean>>({});

  #cfg: SyncConfig | null = null;
  #remote = new Map<string, string>();
  #prefetching = false;
  #order: string[] = [];
  /** Files GitHub refused: not sent again until the app is next opened. */
  #refused = new Set<string>();
  /** Downloads under way, by attachment id. */
  #downloads = new Map<string, Promise<Blob | undefined>>();

  /** Adds files to a question. Returns how many were added and why any were not. */
  async add(q: Question, files: File[]): Promise<{ added: number; problems: string[] }> {
    const problems: string[] = [];
    const records: Attachment[] = [];
    const existing = store.attachmentsFor(q);
    let order = existing.length ? Math.max(...existing.map((a) => a.order)) + 1 : 0;
    for (const file of files) {
      let name = nameOf(file);
      let type = typeOf(name, file.type);
      let blob: Blob = file;
      let width: number | undefined;
      let height: number | undefined;
      if (isImage(type)) {
        const img = await prepareImage(file, type);
        if (img.type !== type) name = asJpegName(name);
        ({ blob, type, width, height } = img);
      }
      if (blob.size > MAX_FILE_BYTES) {
        problems.push(`${name} is ${formatBytes(blob.size)}. Files can be up to ${formatBytes(MAX_FILE_BYTES)}.`);
        continue;
      }
      const id = newId();
      await db.putBlob(id, blob);
      this.#show(id, blob, type);
      records.push({
        id,
        createdAt: '',
        updatedAt: '',
        examId: q.examId,
        questionId: q.id,
        name,
        type,
        size: blob.size,
        path: attachmentPath(q.examId, id, extensionOf(name, type)),
        width,
        height,
        order: order++,
      });
    }
    if (records.length) await store.saveAttachments(records);
    return { added: records.length, problems };
  }

  async remove(a: Attachment): Promise<void> {
    await store.deleteAttachments([a]);
    this.#forget(a.id);
  }

  /** Makes a file ready to show: from this device, or downloaded when it isn't here yet. */
  async load(a: Attachment): Promise<void> {
    if (this.urls[a.id]) return;
    // Not downloaded (offline, or not synced yet): shown as such, and tried again after the next sync.
    const blob = (await db.getBlob(a.id)) ?? (await this.#fetch(a).catch(() => undefined));
    if (blob) this.#show(a.id, blob, a.type);
    else this.missing = { ...this.missing, [a.id]: true };
  }

  /** The file itself, for sharing or saving. */
  async file(a: Attachment): Promise<File | null> {
    const blob = await db.getBlob(a.id);
    return blob ? new File([blob], a.name, { type: a.type }) : null;
  }

  #show(id: string, blob: Blob, type: string) {
    if (this.urls[id]) return;
    // The record's type, not whatever the browser guessed when the file was picked.
    const typed = blob.type === type ? blob : new Blob([blob], { type });
    this.urls = { ...this.urls, [id]: URL.createObjectURL(typed) };
    this.#order.push(id);
    if (this.missing[id]) {
      const { [id]: _found, ...rest } = this.missing;
      this.missing = rest;
    }
    // Let go of the files shown longest ago (they are loaded again when needed).
    while (this.#order.length > KEEP_URLS) this.#forget(this.#order[0]);
  }

  #forget(id: string) {
    this.#order = this.#order.filter((x) => x !== id);
    const url = this.urls[id];
    if (!url) return;
    URL.revokeObjectURL(url);
    const { [id]: _gone, ...rest } = this.urls;
    this.urls = rest;
  }

  /** Downloads a file to this device: once, however many ask for it at the same time. */
  #fetch(a: Attachment): Promise<Blob | undefined> {
    const cfg = this.#cfg;
    const sha = this.#remote.get(a.path);
    if (!cfg || !sha || !navigator.onLine) return Promise.resolve(undefined);
    let job = this.#downloads.get(a.id);
    if (!job) {
      job = (async () => {
        const here = await db.getBlob(a.id); // finished a moment ago
        if (here) return here;
        const bytes = await getBlobBytes(cfg, sha);
        const blob = new Blob([bytes as BlobPart], { type: a.type });
        await db.putBlob(a.id, blob);
        return blob;
      })().finally(() => this.#downloads.delete(a.id));
      this.#downloads.set(a.id, job);
    }
    return job;
  }

  /**
   * Part of a sync, before the data files are written, so a file's record doesn't reach other
   * devices before the file does: uploads files added here, and removes from the repo files that
   * were deleted. `remote` is the repo's file list (path → sha) and is kept up to date.
   * A file GitHub refuses is skipped (and tried again next time) rather than stopping the sync.
   */
  async syncBytes(cfg: SyncConfig, remote: Map<string, string>): Promise<void> {
    this.#cfg = cfg;
    this.#remote = remote;
    const here = await db.blobIds();
    for (const a of store.data.files) {
      const sha = remote.get(a.path);
      try {
        if (a.deleted) {
          if (sha) {
            await deleteFile(cfg, a.path, sha, 'Remove a file');
            remote.delete(a.path);
          }
          if (here.has(a.id)) await db.deleteBlob(a.id);
          this.#forget(a.id);
        } else if (!sha && here.has(a.id) && !this.#refused.has(a.id)) {
          const blob = await db.getBlob(a.id);
          if (!blob) continue;
          const added = await putBytes(cfg, a.path, new Uint8Array(await blob.arrayBuffer()), 'Add a file');
          if (added) remote.set(a.path, added);
        }
      } catch (e) {
        // Problems with the token or the repo stop the whole sync; anything else only this file.
        if (!(e instanceof GitHubError) || [401, 403, 404].includes(e.status)) throw e;
        if (!a.deleted) {
          this.#refused.add(a.id);
          toasts.show(`“${a.name}” couldn't be uploaded to GitHub (${e.message}). It stays on this device only.`, 'error', 8000);
        }
      }
    }
  }

  /** After a sync: downloads files added on other devices, so they open offline too. */
  async prefetch(): Promise<void> {
    const cfg = this.#cfg;
    if (!cfg || this.#prefetching) return;
    this.#prefetching = true;
    try {
      const here = await db.blobIds();
      for (const a of store.data.files) {
        if (a.deleted || here.has(a.id) || !this.#remote.has(a.path)) continue;
        try {
          const blob = await this.#fetch(a);
          // Shown straight away if it's on screen, waiting for it.
          if (blob && this.missing[a.id]) this.#show(a.id, blob, a.type);
        } catch {
          /* tried again after the next sync */
        }
      }
    } finally {
      this.#prefetching = false;
    }
  }
}

export const attachments = new Attachments();
