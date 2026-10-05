// Keeps this device and the private data repo in step. One request lists the
// repo's files with their fingerprints (git blob shas); only files that changed
// since the last sync are downloaded and merged (newest updatedAt wins per
// record), and only files whose content differs are uploaded. If another device
// saves a file first (409), the whole round starts again.
import { getMeta, setMeta } from './db';
import { GitHubError, getBlobText, listFiles, putText, type SyncConfig } from './github';
import { MAIN_PATH, gitBlobSha, isDataPath, parseFile, toFiles } from './merge';
import { store } from './store.svelte';
import { debounce, nowIso } from './util';

export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'offline';

const CONFIG_KEY = 'sync-config';
const LAST_KEY = 'sync-last';
const SHAS_KEY = 'sync-shas';

/** Files that must be written: every local file whose content differs from the repo's. */
export async function changedFiles(local: Map<string, string>, remote: Map<string, string>): Promise<[string, string][]> {
  const out: [string, string][] = [];
  for (const [path, text] of local) {
    if (remote.get(path) !== (await gitBlobSha(text))) out.push([path, text]);
  }
  return out;
}

export function commitMessage(path: string): string {
  if (path === MAIN_PATH) return 'Update exams and settings';
  const m = path.match(/^exams\/[^/]+\/(questions|notes|progress)\.json$/);
  if (m) return `Update ${m[1]}`;
  return 'Update handwriting';
}

class Sync {
  config = $state<SyncConfig | null>(null);
  state = $state<SyncState>('off');
  error = $state<string | null>(null);
  lastSyncedAt = $state<string | null>(null);
  pending = $state(false);

  #changeCounter = 0;
  #running: Promise<void> | null = null;
  #again = false;

  async init(): Promise<void> {
    this.config = (await getMeta<SyncConfig>(CONFIG_KEY)) ?? null;
    this.lastSyncedAt = (await getMeta<string>(LAST_KEY)) ?? null;
    this.state = this.config ? 'idle' : 'off';

    store.onChange(() => {
      this.#changeCounter++;
      this.pending = true;
      this.#schedule();
    });
    window.addEventListener('online', () => this.run());
    window.addEventListener('offline', () => {
      if (this.config) this.state = 'offline';
    });
    document.addEventListener('visibilitychange', () => {
      // Coming back: fetch changes from other devices. Leaving: save now, in case the app is closed.
      if (document.visibilityState === 'visible' || this.pending) void this.run();
    });
    if (this.config) void this.run();
  }

  #schedule = debounce(() => void this.run(), 3000);

  async configure(cfg: SyncConfig | null): Promise<void> {
    this.config = cfg;
    await setMeta(CONFIG_KEY, cfg ? $state.snapshot(cfg) : null);
    await setMeta(SHAS_KEY, {}); // a new repo: download everything once
    this.error = null;
    this.state = cfg ? 'idle' : 'off';
    if (cfg) await this.run();
  }

  /** Runs a sync now (queues one more if a sync is already running). */
  run(): Promise<void> {
    if (!this.config) return Promise.resolve();
    if (this.#running) {
      this.#again = true;
      return this.#running;
    }
    this.#running = this.#sync().finally(() => {
      this.#running = null;
      if (this.#again) {
        this.#again = false;
        void this.run();
      }
    });
    return this.#running;
  }

  async #sync(): Promise<void> {
    const cfg = this.config;
    if (!cfg) return;
    if (!navigator.onLine) {
      this.state = 'offline';
      return;
    }
    const startCounter = this.#changeCounter;
    this.state = 'syncing';
    try {
      const known = (await getMeta<Record<string, string>>(SHAS_KEY)) ?? {};
      for (let attempt = 0; ; attempt++) {
        const remote = await listFiles(cfg);
        // 1. Bring in files changed on other devices; study.json first, so exams and sets exist before their questions.
        const incoming = [...remote].filter(([path, sha]) => isDataPath(path) && known[path] !== sha);
        incoming.sort(([a], [b]) => (a === MAIN_PATH ? -1 : b === MAIN_PATH ? 1 : a.localeCompare(b)));
        for (const [path, sha] of incoming) {
          await store.applyRemote(parseFile(await getBlobText(cfg, sha)));
          known[path] = sha;
        }
        await setMeta(SHAS_KEY, known);
        // 2. Send what differs.
        const writes = await changedFiles(toFiles(store.data), remote);
        try {
          for (const [path, text] of writes) {
            known[path] = await putText(cfg, path, text, remote.get(path), commitMessage(path));
            await setMeta(SHAS_KEY, known);
          }
          break;
        } catch (e) {
          if (e instanceof GitHubError && e.status === 409 && attempt < 3) continue;
          throw e;
        }
      }
      this.lastSyncedAt = nowIso();
      await setMeta(LAST_KEY, this.lastSyncedAt);
      this.error = null;
      this.state = 'idle';
      if (this.#changeCounter === startCounter) this.pending = false;
      else this.#again = true;
    } catch (e) {
      this.state = navigator.onLine ? 'error' : 'offline';
      this.error = e instanceof Error ? e.message : String(e);
    }
  }
}

export const sync = new Sync();
