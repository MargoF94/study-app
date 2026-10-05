<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { questionsCsv } from '../lib/export';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { describeChoice, examStats, matchesWhich, pickQuestions, type Order, type StudyChoice, type Which } from '../lib/study';
  import { toasts } from '../lib/toast.svelte';
  import { downloadText, loadPref, nowIso, plural, savePref, today } from '../lib/util';

  let { examId }: { examId: string } = $props();

  const exam = $derived(store.exam(examId));
  const sets = $derived(store.setsOf(examId));
  const topics = $derived(store.topicsOf(examId));
  const questions = $derived(store.questionsOf(examId));
  const stats = $derived(examStats(questions, store.progress));
  const session = $derived(store.sessions.get(examId));

  // The last choice on this device; new sets and topics start ticked.
  const saved = loadPref<{ offSets: string[]; offTopics: string[]; which: Which; order: Order }>(`choice:${untrack(() => examId)}`, {
    offSets: [],
    offTopics: [],
    which: 'all',
    order: 'order',
  });
  let offSets = $state<string[]>(saved.offSets);
  let offTopics = $state<string[]>(saved.offTopics);
  let which = $state<Which>(saved.which);
  let order = $state<Order>(saved.order);

  $effect(() => {
    savePref(`choice:${examId}`, { offSets, offTopics, which, order });
  });

  const choice = $derived<StudyChoice>({
    setIds: sets.filter((s) => !offSets.includes(s.id)).map((s) => s.id),
    topics: topics.filter((t) => !offTopics.includes(t)),
    which,
    order,
  });
  const inScope = $derived(questions.filter((q) => choice.setIds.includes(q.setId) && choice.topics.includes(q.topic)));
  const count = $derived(inScope.filter((q) => matchesWhich(store.progress.get(q.id), which)).length);
  const whichCount = (w: Which) => inScope.filter((q) => matchesWhich(store.progress.get(q.id), w)).length;

  function perTopic(t: string) {
    const qs = questions.filter((q) => q.topic === t);
    const answered = qs.filter((q) => (store.progress.get(q.id)?.attempts ?? 0) > 0).length;
    return { total: qs.length, answered };
  }

  function perSet(id: string) {
    const qs = questions.filter((q) => q.setId === id);
    const answered = qs.filter((q) => (store.progress.get(q.id)?.attempts ?? 0) > 0).length;
    return { total: qs.length, answered };
  }

  const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  async function start() {
    const picked = pickQuestions(questions, store.progress, choice);
    if (!picked.length) return;
    const label = describeChoice(
      choice,
      sets.filter((s) => choice.setIds.includes(s.id)).map((s) => s.name),
      choice.setIds.length === sets.length,
      choice.topics.length === topics.length,
    );
    const now = nowIso();
    await store.saveSession({ id: examId, createdAt: session?.createdAt ?? now, updatedAt: now, ids: picked.map((q) => q.id), index: 0, label });
    router.go(`/exam/${examId}/study`);
  }

  function exportCsv() {
    if (!exam) return;
    const safeName = exam.name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'questions';
    downloadText(`${safeName} ${today()}.csv`, questionsCsv(questions, sets), 'text/csv');
    toasts.show(`Exported ${plural(questions.length, 'question')}.`);
  }

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const WHICH: { w: Which; label: string }[] = [
    { w: 'all', label: 'All' },
    { w: 'new', label: 'New' },
    { w: 'wrong', label: 'Wrong' },
    { w: 'flagged', label: 'Flagged' },
  ];
</script>

{#if !exam}
  <TopBar back="#/" backLabel="Exams" title="Not found" />
  <div class="page-body"><div class="card empty">This exam was deleted. <a href="#/">Back to your exams</a></div></div>
{:else}
  <TopBar back="#/" backLabel="Exams">
    {#snippet actions()}
      <a class="btn ghost icon" href="#/exam/{examId}/edit" aria-label="Edit exam" title="Edit exam"><Icon name="edit" /></a>
    {/snippet}
  </TopBar>

  <div class="page-body stack">
    <h1 class="m0">{exam.name}</h1>

    {#if questions.length === 0}
      <div class="card empty stack">
        <p class="m0">No questions yet.</p>
        <div class="row center">
          <a class="btn primary" href="#/import?exam={examId}"><Icon name="upload" /> Import a file</a>
          <a class="btn" href="#/exam/{examId}/new"><Icon name="plus" /> Add a question</a>
        </div>
      </div>
    {:else}
      <div class="tiles">
        <div class="tile"><span class="tl">Answered</span><span class="tv">{stats.answered}</span><span class="ts">of {stats.total}</span></div>
        <div class="tile"><span class="tl">Correct</span><span class="tv ok">{stats.right}</span><span class="ts">{pct(stats.right, stats.answered)}% of answered</span></div>
        <div class="tile"><span class="tl">Wrong</span><span class="tv bad">{stats.wrong}</span><span class="ts">to review</span></div>
        <div class="tile"><span class="tl">Flagged</span><span class="tv">{stats.flagged}</span><span class="ts">by you</span></div>
      </div>

      {#if session && session.ids.length}
        <a class="card continue" href="#/exam/{examId}/study">
          <span><strong>Continue</strong> · question {Math.min(session.index + 1, session.ids.length)} of {session.ids.length}<br /><span class="small muted">{session.label}</span></span>
          <Icon name="arrow" />
        </a>
      {/if}

      <section class="card stack">
        <h2 class="m0">Study</h2>

        {#if sets.length > 1}
          <div class="group">
            <h3 class="cap">Question sets</h3>
            {#each sets as s (s.id)}
              {@const n = perSet(s.id)}
              <button type="button" class="tick" aria-pressed={!offSets.includes(s.id)} onclick={() => (offSets = toggle(offSets, s.id))}>
                <span class="box"><Icon name="check" size={14} /></span>
                <span class="tick-text"><span class="tname">{s.name}</span><span class="small muted">{plural(n.total, 'question')} · {n.answered} answered</span></span>
              </button>
            {/each}
          </div>
        {/if}

        {#if topics.length > 1}
          <div class="group">
            <div class="row between">
              <h3 class="cap">Topics</h3>
              <button type="button" class="btn ghost small" onclick={() => (offTopics = offTopics.length ? [] : [...topics])}>{offTopics.length ? 'Select all' : 'Clear all'}</button>
            </div>
            {#each topics as t (t)}
              {@const n = perTopic(t)}
              <button type="button" class="tick" aria-pressed={!offTopics.includes(t)} onclick={() => (offTopics = toggle(offTopics, t))}>
                <span class="box"><Icon name="check" size={14} /></span>
                <span class="tick-text">
                  <span class="tname">{t || 'No topic'}</span>
                  <span class="barline"><span class="bar" aria-hidden="true"><span style:width="{pct(n.answered, n.total)}%"></span></span><span class="small muted">{n.answered} / {n.total}</span></span>
                </span>
              </button>
            {/each}
          </div>
        {/if}

        <div class="group">
          <h3 class="cap">Which questions</h3>
          <div class="segs four" role="group" aria-label="Which questions">
            {#each WHICH as x (x.w)}
              <button type="button" aria-pressed={which === x.w} class:on={which === x.w} onclick={() => (which = x.w)}>{x.label}<span class="cnt">{whichCount(x.w)}</span></button>
            {/each}
          </div>
        </div>

        <div class="group">
          <h3 class="cap">Order</h3>
          <div class="segs" role="group" aria-label="Order">
            <button type="button" aria-pressed={order === 'order'} class:on={order === 'order'} onclick={() => (order = 'order')}>In order</button>
            <button type="button" aria-pressed={order === 'shuffle'} class:on={order === 'shuffle'} onclick={() => (order = 'shuffle')}>Shuffled</button>
          </div>
        </div>

        <button type="button" class="btn primary go" disabled={count === 0} onclick={start}>
          {count ? `Study ${plural(count, 'question')}` : 'No questions match'}
        </button>
        <button type="button" class="btn soon" disabled>Exam mode (timed, scored): coming later</button>
      </section>
    {/if}

    <section class="card list">
      <h2>Questions</h2>
      {#if questions.length}
        <a href="#/exam/{examId}/questions"><Icon name="list" /> <span>Browse and search questions</span><Icon name="next" size={18} /></a>
      {/if}
      <a href="#/import?exam={examId}"><Icon name="upload" /> <span>Import or update from a file</span><Icon name="next" size={18} /></a>
      {#if questions.length}
        <button type="button" onclick={exportCsv}><Icon name="download" /> <span>Export as CSV (with your edits)</span></button>
      {/if}
      <a href="#/exam/{examId}/new"><Icon name="plus" /> <span>Add a question</span><Icon name="next" size={18} /></a>
    </section>
  </div>
{/if}

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px;
    min-width: 0;
  }

  .tl {
    font-size: 0.78rem;
    color: var(--text-2);
  }

  .tv {
    font-size: 1.3rem;
    font-weight: 700;
  }

  .tv.ok {
    color: var(--ok);
  }

  .tv.bad {
    color: var(--danger);
  }

  .ts {
    font-size: 0.72rem;
    color: var(--text-2);
  }

  .continue {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    text-decoration: none;
    color: var(--text);
  }

  .continue :global(svg) {
    color: var(--accent);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cap {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .between {
    justify-content: space-between;
  }

  .center {
    justify-content: center;
  }

  .tick {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 50px;
    padding: 4px 0;
    border: 0;
    background: none;
    text-align: left;
    color: var(--text);
  }

  .box {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--text-2);
    color: transparent;
  }

  .tick[aria-pressed='true'] .box {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }

  .tick-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .tname {
    font-weight: 550;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .barline {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bar {
    flex: 1;
    height: 5px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }

  .segs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border-radius: 10px;
    background: var(--surface-2);
  }

  .segs.four {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .segs button {
    min-height: 42px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-2);
    font-weight: 600;
    font-size: 0.9rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.15;
  }

  .segs button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgb(20 26 32 / 0.15);
  }

  .cnt {
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--text-2);
  }

  .go {
    min-height: 52px;
    font-size: 1.05rem;
    font-weight: 650;
  }

  .soon {
    border-style: dashed;
    color: var(--text-2);
    white-space: normal;
  }

  .list {
    padding: 0;
    overflow: hidden;
  }

  .list h2 {
    margin: 0;
    padding: 14px 16px 6px;
  }

  .list a,
  .list button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 0 16px;
    border: 0;
    border-top: 1px solid var(--surface-2);
    background: none;
    color: var(--text);
    text-decoration: none;
    text-align: left;
  }

  .list a span,
  .list button span {
    flex: 1;
  }

  .list :global(svg:first-child) {
    color: var(--accent);
  }
</style>
