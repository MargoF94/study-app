<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { cleanUrl, isWebUrl, linkInfo } from '../lib/links';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import type { Link } from '../lib/types';
  import { newId, nowIso } from '../lib/util';

  // Edit a link (id), or add one to an exam (?exam=) and optionally a question (&q=).
  let { id }: { id?: string } = $props();

  const { original, examId, presetQuestion } = untrack(() => {
    const original = id ? store.linksById.get(id) : undefined;
    const q = router.route.query;
    return { original, examId: original?.examId ?? q.get('exam') ?? '', presetQuestion: original ? original.questionId : (q.get('q') ?? undefined) };
  });
  const exam = store.exam(examId);
  const question = presetQuestion ? store.question(presetQuestion) : undefined;

  let url = $state(original?.url ?? '');
  let title = $state(original?.title ?? '');
  let scope = $state<'question' | 'exam'>(question ? 'question' : 'exam');
  let error = $state('');

  const cleaned = $derived(cleanUrl(url));
  const info = $derived(cleaned ? linkInfo(cleaned) : null);
  const valid = $derived(isWebUrl(cleaned));

  const where = $derived(
    question
      ? `${store.setsById.get(question.setId)?.name ?? ''}${question.qid ? ` · Q${question.qid}` : ''}`
      : '',
  );

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) url = text.trim();
    } catch {
      toasts.show('Pasting was blocked. Long-press the box and choose Paste.', 'error');
    }
  }

  function back() {
    if (history.length > 1) history.back();
    else router.go(`/exam/${examId}`);
  }

  async function save(e: Event) {
    e.preventDefault();
    error = '';
    if (!valid) return void (error = 'Enter a web address, starting with https:// (or just docs.google.com/…).');
    const now = nowIso();
    const siblings = store.linksOf(examId);
    const link: Link = {
      ...(original ?? { id: newId(), createdAt: now, updatedAt: now, examId, order: siblings.length ? Math.max(...siblings.map((l) => l.order)) + 1 : 0 }),
      url: cleaned,
      title: title.trim(),
      questionId: scope === 'question' && question ? question.id : undefined,
    };
    await store.saveLink(link);
    toasts.show(original ? 'Link saved.' : 'Link added.');
    back();
  }

  async function remove() {
    if (!original || !confirm('Remove this link?')) return;
    await store.deleteLink(original);
    toasts.show('Link removed.');
    back();
  }
</script>

<TopBar title={original ? 'Edit link' : 'Add link'} sub={exam?.name}>
  {#snippet actions()}
    <button type="button" class="btn ghost" onclick={back}>Cancel</button>
    <button type="submit" form="lform" class="btn primary save">Save</button>
  {/snippet}
</TopBar>

{#if !exam || (id && !original)}
  <div class="page-body"><div class="card empty">This link no longer exists.</div></div>
{:else}
  <form id="lform" class="page-body stack" novalidate onsubmit={save}>
    <label class="field">
      <span>Link</span>
      <span class="row nowrap">
        <input type="text" inputmode="url" aria-label="Link address" autocapitalize="off" autocomplete="off" spellcheck="false" bind:value={url} placeholder="https://…" />
        <button type="button" class="btn" onclick={paste}>Paste</button>
      </span>
    </label>

    {#if info && valid}
      <div class="card kind">
        <span class="badge k-{info.kind}" aria-hidden="true">{info.mark}</span>
        <span class="col">
          <strong>{info.label}</strong>
          <span class="small muted">Recognised from the address · {info.host}</span>
        </span>
      </div>
    {/if}

    <label class="field">
      <span>Title</span>
      <input bind:value={title} placeholder="e.g. Permission sets cheat sheet" />
      <span class="small muted">Leave it empty to show the address instead.</span>
    </label>

    <div class="field">
      <span>Add to</span>
      {#if question}
        <div class="segs" role="group" aria-label="Add to">
          <button type="button" class:on={scope === 'question'} aria-pressed={scope === 'question'} onclick={() => (scope = 'question')}>This question</button>
          <button type="button" class:on={scope === 'exam'} aria-pressed={scope === 'exam'} onclick={() => (scope = 'exam')}>The whole exam</button>
        </div>
        <span class="small muted">
          {scope === 'question' ? `Shown on ${where}, and in the exam's link list.` : "Shown on the exam page, and under every question's links."}
        </span>
      {:else}
        <span class="small muted">The whole exam: shown on the exam page, and under every question's links.</span>
      {/if}
    </div>

    <p class="small muted m0">Links open in a new tab. Google Docs and Sheets that aren't shared publicly open for whoever is signed in to Google with access.</p>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <div class="row">
      <button class="btn primary">Save</button>
      {#if original}<button type="button" class="btn danger" onclick={remove}><Icon name="trash" /> Remove link</button>{/if}
    </div>
  </form>
{/if}

<style>
  .nowrap {
    flex-wrap: nowrap;
  }

  .kind {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
  }

  .col {
    display: flex;
    flex-direction: column;
  }

  .badge {
    flex: none;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    color: #fff;
    background: #3d5467;
  }
  .k-sheet {
    background: #1e7a43;
  }
  .k-doc {
    background: #2f5fa8;
  }
  .k-slides {
    background: #9a6a12;
  }
  .k-pdf {
    background: #a8323a;
  }
  .k-drive {
    background: #4a5a6a;
  }
  .k-video {
    background: #7a3a8a;
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

  .save {
    border-radius: 999px;
  }
</style>
