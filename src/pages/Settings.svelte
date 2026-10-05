<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { checkRepo } from '../lib/github';
  import { parseFile, toBackup } from '../lib/merge';
  import { store } from '../lib/store.svelte';
  import { sync } from '../lib/sync.svelte';
  import { toasts } from '../lib/toast.svelte';
  import type { Theme } from '../lib/types';
  import { ui } from '../lib/ui.svelte';
  import { downloadText, nowIso, plural, today } from '../lib/util';

  // Guess the GitHub user from the Pages address (<user>.github.io).
  const guessedOwner = location.hostname.endsWith('.github.io') ? location.hostname.split('.')[0] : '';

  let owner = $state(sync.config?.owner ?? guessedOwner);
  let repo = $state(sync.config?.repo ?? 'study-data');
  let token = $state('');
  let connecting = $state(false);
  let connectError = $state('');

  async function connect(e: Event) {
    e.preventDefault();
    connectError = '';
    const cfg = { owner: owner.trim(), repo: repo.trim(), token: token.trim() };
    if (!cfg.owner || !cfg.repo || !cfg.token) return void (connectError = 'Fill in all three fields.');
    connecting = true;
    try {
      const info = await checkRepo(cfg);
      if (!info.private && !confirm(`${info.fullName} is PUBLIC: anyone could read your questions and notes. Connect anyway? (Make the repo private first.)`)) return;
      await sync.configure(cfg);
      token = '';
      if (sync.state === 'error') connectError = sync.error ?? '';
      else toasts.show('Sync connected.');
    } catch (err) {
      connectError = err instanceof Error ? err.message : String(err);
    } finally {
      connecting = false;
    }
  }

  async function disconnect() {
    if (!confirm('Stop syncing on this device? Your data stays here and in the data repo.')) return;
    await sync.configure(null);
  }

  const lastSynced = $derived(sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : 'never');

  function download() {
    downloadText(`study-log-${today()}.json`, toBackup(store.data, nowIso()), 'application/json');
  }

  let fileInput: HTMLInputElement | undefined = $state();
  async function restore(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const n = await store.applyRemote(parseFile(await file.text()));
      toasts.show(n ? `Loaded ${plural(n, 'change')}.` : 'Nothing new in that file.');
      if (n) void sync.run();
    } catch (err) {
      toasts.show(err instanceof Error ? err.message : 'Could not read that file.', 'error');
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }

  const questionCount = $derived(store.questionsById.size);
</script>

<TopBar back="#/" backLabel="Exams" title="Settings" />

<div class="page-body stack">
  <section class="card stack">
    <h2 class="m0">Sync</h2>
    {#if sync.config}
      <p class="m0">Connected to <strong>{sync.config.owner}/{sync.config.repo}</strong>.<br /><span class="small muted">Last synced: {lastSynced}</span></p>
      {#if sync.error}<p class="error" role="alert">{sync.error}</p>{/if}
      <div class="row">
        <button type="button" class="btn primary" disabled={sync.state === 'syncing'} onclick={() => sync.run()}>{sync.state === 'syncing' ? 'Syncing…' : 'Sync now'}</button>
        <button type="button" class="btn" onclick={disconnect}>Disconnect</button>
      </div>
      <details>
        <summary class="small">Replace the token</summary>
        <form class="stack" style="margin-top:0.75rem" onsubmit={connect}>
          <label class="field"><span>New token</span><input type="password" bind:value={token} autocomplete="off" /></label>
          {#if connectError}<p class="error" role="alert">{connectError}</p>{/if}
          <div><button class="btn" disabled={connecting}>Save token</button></div>
        </form>
      </details>
    {:else}
      <p class="m0 small">Save your exams, notes and handwriting to your private <code>study-data</code> repo so your iPad, phone and computer share them. Without sync, they live only in this browser.</p>
      <form class="stack" onsubmit={connect}>
        <div class="grid-2">
          <label class="field"><span>GitHub username</span><input bind:value={owner} autocapitalize="off" autocomplete="off" /></label>
          <label class="field"><span>Data repo</span><input bind:value={repo} autocapitalize="off" autocomplete="off" /></label>
        </div>
        <label class="field"><span>Access token</span><input type="password" bind:value={token} autocomplete="off" placeholder="github_pat_…" /></label>
        {#if connectError}<p class="error" role="alert">{connectError}</p>{/if}
        <div><button class="btn primary" disabled={connecting}>{connecting ? 'Connecting…' : 'Connect'}</button></div>
      </form>
      <details>
        <summary class="small">How to create the token</summary>
        <ol class="small help">
          <li>On GitHub: profile picture → <strong>Settings</strong> → <strong>Developer settings</strong> → <strong>Personal access tokens</strong> → <strong>Fine-grained tokens</strong> → <strong>Generate new token</strong>.</li>
          <li>Expiration: pick the longest you're comfortable with (you'll paste a new one when it runs out).</li>
          <li>Repository access: <strong>Only select repositories</strong> → <code>study-data</code>.</li>
          <li>Permissions → Repository permissions → <strong>Contents: Read and write</strong>.</li>
          <li>Generate, copy, and paste it above. It is stored only on this device.</li>
        </ol>
      </details>
    {/if}
  </section>

  <section class="card stack">
    <h2 class="m0">Appearance</h2>
    <label class="field">
      <span>Theme</span>
      <select value={store.settings.theme} onchange={(e) => store.saveSettings({ theme: e.currentTarget.value as Theme })}>
        <option value="system">Match device</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  </section>

  <section class="card stack">
    <h2 class="m0">Handwriting</h2>
    <div class="segs" role="group" aria-label="Write with">
      <button type="button" class:on={ui.pencilOnly} aria-pressed={ui.pencilOnly} onclick={() => ui.setPencilOnly(true)}>Apple Pencil only</button>
      <button type="button" class:on={!ui.pencilOnly} aria-pressed={!ui.pencilOnly} onclick={() => ui.setPencilOnly(false)}>Pencil and finger</button>
    </div>
    <p class="small muted m0">With "Apple Pencil only", your finger and palm scroll the page and never leave marks. Choose "Pencil and finger" on a phone. A mouse always writes.</p>
  </section>

  <section class="card stack">
    <h2 class="m0">Backup</h2>
    <p class="small muted m0">{plural(store.exams.length, 'exam')}, {plural(questionCount, 'question')}. A backup file can be loaded on any device; it is merged with what's already there.</p>
    <div class="row">
      <button type="button" class="btn" onclick={download}><Icon name="download" size={18} />Download backup</button>
      <button type="button" class="btn" onclick={() => fileInput?.click()}><Icon name="upload" size={18} />Load a backup…</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={restore} />
    </div>
  </section>

  <p class="small muted center">Study Log · your data stays on your devices and in your private repo.</p>
</div>

<style>
  summary {
    cursor: pointer;
    color: var(--accent);
  }

  .help {
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  code {
    background: var(--surface-2);
    padding: 0 0.3em;
    border-radius: 3px;
  }

  .segs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border-radius: 10px;
    background: var(--surface-2);
  }

  .segs button {
    min-height: 42px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-2);
    font-weight: 600;
  }

  .segs button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgb(20 26 32 / 0.15);
  }

  .center {
    text-align: center;
  }
</style>
