<script lang="ts">
  // Screenshots and files attached to one question: pictures as thumbnails, other files as rows.
  // Add them with the button (on iPad: Photos, the camera or Files), by pasting a copied
  // screenshot, or by dropping files on the page. Tap one to see it full size.
  import { attachments } from '../lib/attachments.svelte';
  import { badgeOf, formatBytes, isImage, kindOf, MAX_FILE_BYTES, nameOf } from '../lib/files';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import type { Question } from '../lib/types';
  import FileViewer from './FileViewer.svelte';
  import Icon from './Icon.svelte';

  let { question }: { question: Question } = $props();

  const files = $derived(store.attachmentsFor(question));
  const pictures = $derived(files.filter((f) => isImage(f.type)));
  const others = $derived(files.filter((f) => !isImage(f.type)));
  /** Pictures this browser can't show (an iPhone photo on Windows, say): listed as files instead. */
  let broken = $state<Record<string, boolean>>({});
  let adding = $state(0);
  let over = $state(false);
  let viewing = $state<string | null>(null);
  let box = $state<HTMLElement>();
  const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.read;

  $effect(() => {
    for (const f of files) void attachments.load(f);
  });

  async function add(list: File[]) {
    if (!list.length) return;
    const q = question; // the question on screen now, even if the page moves on meanwhile
    adding++;
    try {
      const { added, problems } = await attachments.add(q, list);
      for (const p of problems) toasts.show(p, 'error', 6000);
      if (added) toasts.show(added === 1 ? 'File added.' : `${added} files added.`);
    } catch (e) {
      toasts.show(`The file couldn't be added. ${e instanceof Error ? e.message : ''}`.trim(), 'error', 6000);
    } finally {
      adding--;
    }
  }

  function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    void add([...(input.files ?? [])]);
    input.value = ''; // so the same file can be picked again
  }

  /** The Paste button: a screenshot copied on iPad ("Copy and Delete") or any copied picture. */
  async function paste() {
    let items: ClipboardItems;
    try {
      items = await navigator.clipboard.read();
    } catch {
      toasts.show('Nothing was pasted. Copy a screenshot or picture first, then tap Paste.', 'error', 5000);
      return;
    }
    const found: File[] = [];
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) {
        const blob = await item.getType(type);
        found.push(new File([blob], nameOf({ name: '', type }), { type }));
      }
    }
    if (found.length) await add(found);
    else toasts.show('There is no picture to paste. Copy a screenshot or picture first.', 'error', 5000);
  }

  /** Cmd/Ctrl+V anywhere on the page. Text pasted into a text box stays a text paste. */
  function onpaste(e: ClipboardEvent) {
    const data = e.clipboardData;
    const list = [...(data?.files ?? [])];
    if (!data || !list.length) return;
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, [contenteditable]') && data.types.includes('text/plain')) return;
    e.preventDefault();
    void add(list.map((f) => new File([f], nameOf(f), { type: f.type })));
  }

  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

  // Files dropped anywhere on the page are added here (instead of the browser leaving the app to open them).
  function ondragover(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    over = true;
  }

  function ondragleave(e: DragEvent) {
    if (!e.relatedTarget) over = false; // left the window
  }

  function ondrop(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    over = false;
    void add([...(e.dataTransfer?.files ?? [])]);
  }

  $effect(() => {
    if (over) box?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
</script>

<svelte:window {onpaste} {ondragover} {ondragleave} {ondrop} />

<section class="card qfiles" class:over bind:this={box} aria-label="Files on this question">
  <div class="fhead">
    <h2 class="m0">Files <span class="small muted">· this question</span></h2>
    <div class="acts">
      {#if canPaste}
        <button type="button" class="btn small" onclick={paste} title="Paste a copied screenshot or picture"><Icon name="clipboard" size={17} /> Paste</button>
      {/if}
      <label class="btn small add" title="Add screenshots, photos or files">
        <Icon name="plus" size={17} /> Add
        <input class="visually-hidden" type="file" multiple onchange={picked} />
      </label>
    </div>
  </div>

  {#if pictures.length}
    <div class="grid">
      {#each pictures as f (f.id)}
        <button type="button" class="thumb" onclick={() => (viewing = f.id)} aria-label="Open {f.name}" title={f.name}>
          {#if attachments.urls[f.id] && !broken[f.id]}
            <img src={attachments.urls[f.id]} alt="" loading="lazy" decoding="async" onerror={() => (broken = { ...broken, [f.id]: true })} />
          {:else}
            <span class="wait">
              <Icon name="image" size={22} />
              <span class="small">{broken[f.id] ? f.name : attachments.missing[f.id] ? 'Not downloaded yet' : 'Loading…'}</span>
            </span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#each others as f (f.id)}
    <button type="button" class="frow" onclick={() => (viewing = f.id)}>
      <span class="badge k-{kindOf(f.name, f.type)}" aria-hidden="true">{badgeOf(f.name, f.type)}</span>
      <span class="text">
        <span class="name">{f.name}</span>
        <span class="meta">{formatBytes(f.size)}{attachments.missing[f.id] ? ' · not downloaded yet' : ''}</span>
      </span>
      <Icon name="next" size={18} />
    </button>
  {/each}

  {#if adding}
    <p class="small muted note" role="status">Adding…</p>
  {:else if !files.length}
    <p class="small muted note">Add screenshots, photos, PDFs or other files (up to {formatBytes(MAX_FILE_BYTES)} each). You can also paste a copied screenshot or drop files here.</p>
  {/if}

  {#if over}
    <div class="drop" aria-hidden="true"><Icon name="paperclip" size={22} /> Drop to add to this question</div>
  {/if}
</section>

{#if viewing}
  <FileViewer list={files} start={viewing} onclose={() => (viewing = null)} />
{/if}

<style>
  .qfiles {
    position: relative;
    padding: 0 0 4px;
  }

  .fhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px 6px 16px;
  }

  .acts {
    display: flex;
    gap: 6px;
  }

  .add:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
    padding: 4px 16px 10px;
  }

  .thumb {
    aspect-ratio: 4 / 3;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }

  .thumb:hover {
    border-color: var(--accent);
  }

  .wait {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .frow {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px 8px 16px;
    border: 0;
    background: none;
    color: var(--text);
    text-align: left;
  }

  .frow:hover .name {
    text-decoration: underline;
  }

  .frow > :global(svg) {
    color: var(--text-2);
  }

  .badge {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #fff;
    background: #4a5a6a;
  }

  .k-pdf {
    background: #a8323a;
  }
  .k-doc {
    background: #2f5fa8;
  }
  .k-sheet {
    background: #1e7a43;
  }
  .k-slides {
    background: #9a6a12;
  }
  .k-image {
    background: #7a3a8a;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .name {
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: 0.8rem;
    color: var(--text-2);
  }

  .note {
    margin: 0;
    padding: 2px 16px 10px;
  }

  .drop {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 2px dashed var(--accent);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--accent-soft) 88%, transparent);
    color: var(--accent);
    font-weight: 650;
    pointer-events: none;
  }
</style>
