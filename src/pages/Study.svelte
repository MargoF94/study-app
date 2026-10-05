<script lang="ts">
  import HighlightMenu from '../components/HighlightMenu.svelte';
  import Icon from '../components/Icon.svelte';
  import InkToolbar from '../components/InkToolbar.svelte';
  import Linkified from '../components/Linkified.svelte';
  import MarkedText from '../components/MarkedText.svelte';
  import MemoPad from '../components/MemoPad.svelte';
  import QuestionPage from '../components/QuestionPage.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { isRight, recordAnswer } from '../lib/study';
  import type { Question, Stroke } from '../lib/types';
  import { ui } from '../lib/ui.svelte';
  import { debounce, nowIso } from '../lib/util';

  let { examId }: { examId: string } = $props();

  const exam = $derived(store.exam(examId));
  const session = $derived(store.sessions.get(examId));
  const total = $derived(session?.ids.length ?? 0);
  const index = $derived(session ? Math.min(Math.max(session.index, 0), Math.max(total - 1, 0)) : 0);
  const question = $derived(session ? store.question(session.ids[index]) : undefined);
  const setName = $derived(question ? store.setsById.get(question.setId)?.name : '');

  let chosen = $state<number[]>([]);
  let checked = $state(false);
  let wasRight = $state(false);
  let noteText = $state('');
  let root: HTMLElement | undefined = $state();

  // A new question: fresh answer, its note, and a new undo history.
  let shownId = '';
  $effect.pre(() => {
    const id = question?.id ?? '';
    if (id === shownId) return;
    shownId = id;
    chosen = [];
    checked = false;
    noteText = question ? (store.notes.get(question.id)?.text ?? '') : '';
    ui.clearHistory();
  });

  const progress = $derived(question ? store.progress.get(question.id) : undefined);
  const ranges = $derived(question ? (store.marks.get(question.id)?.ranges ?? []) : []);
  const pageStrokes = $derived(question ? (store.inkFor(question.id, 'page')?.strokes ?? []) : []);

  function choose(i: number) {
    if (checked || !question) return;
    if (question.correct.length > 1) chosen = chosen.includes(i) ? chosen.filter((x) => x !== i) : [...chosen, i].sort();
    else chosen = [i];
  }

  async function check() {
    if (!question || chosen.length === 0 || checked) return;
    checked = true;
    wasRight = isRight(chosen, question.correct);
    await store.saveProgress(recordAnswer(progress, { id: question.id, examId: question.examId }, wasRight, nowIso()));
  }

  async function go(delta: number) {
    if (!session) return;
    const next = index + delta;
    if (next < 0 || next >= total) return;
    saveNoteNow();
    await store.saveSession({ ...session, index: next });
    window.scrollTo(0, 0);
  }

  function saveNoteNow(q: Question | undefined = question) {
    if (q) void store.saveNote(q, noteText);
  }
  const saveNoteSoon = debounce((q: Question, text: string) => void store.saveNote(q, text), 800);

  function savePageInk(next: Stroke[]) {
    if (question) void store.saveInk(question, 'page', { strokes: next });
  }

  function onkey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key) && question && Number(e.key) <= question.options.length) choose(Number(e.key) - 1);
    else if (e.key === 'Enter' && !checked && !t.closest('button, a, [role=radio], [role=checkbox]')) void check();
    else if (e.key === 'ArrowRight') void go(1);
    else if (e.key === 'ArrowLeft') void go(-1);
  }

  const atEnd = $derived(index >= total - 1);
  const correctLabel = $derived(question ? question.correct.map((i) => i + 1).join(' and ') : '');
</script>

<svelte:window onkeydown={onkey} />

{#if !exam}
  <TopBar back="#/" backLabel="Exams" title="Not found" />
  <div class="page-body"><div class="card empty">This exam was deleted.</div></div>
{:else if !session || total === 0}
  <TopBar back="#/exam/{examId}" backLabel="Exam" title={exam.name} />
  <div class="page-body"><div class="card empty">Choose questions to study on the exam page. <a href="#/exam/{examId}">Go to the exam</a></div></div>
{:else}
  <TopBar back="#/exam/{examId}" backLabel="Exam" title="{index + 1} / {total}" sub="{setName ?? ''}{session.label ? ' · ' + session.label : ''}">
    {#snippet actions()}
      <div class="seg" role="group" aria-label="View">
        <button type="button" aria-pressed={ui.mode === 'clean'} class:on={ui.mode === 'clean'} onclick={() => ui.setMode('clean')}>Clean</button>
        <button type="button" aria-pressed={ui.mode === 'notes'} class:on={ui.mode === 'notes'} onclick={() => ui.setMode('notes')}>Notes</button>
      </div>
      <button type="button" class="btn ghost write" class:on={ui.writing} aria-pressed={ui.writing} onclick={() => ui.toggleWriting()} title="Write by hand">
        <Icon name="pen" /><span class="wl">Write</span>
      </button>
      {#if question}
        <button type="button" class="btn ghost icon" aria-pressed={!!progress?.flagged} aria-label="Flag question" title="Flag" onclick={() => store.toggleFlag(question)}>
          <Icon name="flag" filled={!!progress?.flagged} />
        </button>
        <a class="btn ghost icon" href="#/q/{question.id}/edit" aria-label="Edit question" title="Edit"><Icon name="edit" /></a>
      {/if}
    {/snippet}
  </TopBar>

  {#if ui.writing}
    <div class="toolbar-wrap"><InkToolbar /></div>
  {/if}

  <div class="page-body study" class:wide={ui.notes} bind:this={root}>
    {#if !question}
      <div class="card empty">This question was deleted.</div>
    {:else}
      {#if question.needsReview}
        <p class="review small"><Icon name="alert" size={18} /> Imported with a problem: the correct answer didn't match an option. <a href="#/q/{question.id}/edit">Fix it</a></p>
      {/if}

      <QuestionPage
        {question}
        {chosen}
        {checked}
        onchoose={choose}
        notes={ui.notes}
        writing={ui.writing}
        {ranges}
        strokes={pageStrokes}
        onink={savePageInk}
      />

      {#if checked}
        <div class="result" class:right={wasRight} role="status">
          <Icon name={wasRight ? 'check' : 'close'} size={22} />
          {wasRight ? 'Correct' : `Not quite. The answer is ${correctLabel}.`}
        </div>
        {#if question.explanation || question.reference}
          <section class="card explain">
            {#if question.explanation}
              <h2 class="label-h">Explanation</h2>
              <p class="m0"><MarkedText text={question.explanation} field="e" {ranges} show={ui.notes} /></p>
            {/if}
            {#if question.reference}
              <p class="ref small"><span class="muted">Reference:</span> <Linkified text={question.reference} /></p>
            {/if}
          </section>
        {/if}
      {/if}

      {#if ui.notes}
        <section class="notes">
          <h2>Your notes</h2>
          <label class="field">
            <span>Note</span>
            <textarea
              rows="3"
              bind:value={noteText}
              oninput={() => saveNoteSoon(question, noteText)}
              onblur={() => saveNoteNow()}
              placeholder="Type a note for this question"
            ></textarea>
          </label>
          <div class="field">
            <span>Memo (handwritten)</span>
            <MemoPad {question} />
          </div>
          {#if !ui.writing}
            <p class="small muted m0">Tip: select words in the question, an option or the explanation to highlight them.</p>
          {/if}
        </section>
      {/if}

      <HighlightMenu {question} enabled={ui.notes && !ui.writing} {root} />
    {/if}
  </div>

  <footer class="bottom">
    <div class="bottom-inner">
      <button type="button" class="btn nav" aria-label="Previous question" disabled={index === 0} onclick={() => go(-1)}><Icon name="back" size={22} /></button>
      {#if question && !checked}
        <button type="button" class="btn primary big" disabled={chosen.length === 0} onclick={check}>Check answer</button>
      {:else if atEnd}
        <a class="btn primary big" href="#/exam/{examId}">Finish</a>
      {:else}
        <button type="button" class="btn primary big" onclick={() => go(1)}>Next question <Icon name="next" /></button>
      {/if}
      <button type="button" class="btn nav" aria-label="Skip to next question" disabled={atEnd} onclick={() => go(1)}><Icon name="next" size={22} /></button>
    </div>
  </footer>
{/if}

<style>
  .study {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }

  /* Notes mode uses the whole screen width: room to write beside the question and a wide memo pad. */
  .study.wide {
    max-width: none;
  }

  .study.wide > :global(*:not(.frame):not(.notes)) {
    width: 100%;
    max-width: calc(var(--page-max) - 32px);
    margin-inline: auto;
    box-sizing: border-box;
  }

  .study.wide .notes > :global(*:not(.field:has(.memo))) {
    width: 100%;
    max-width: calc(var(--page-max) - 32px);
    margin-inline: auto;
  }

  .toolbar-wrap {
    position: sticky;
    top: calc(57px + env(safe-area-inset-top));
    z-index: 25;
    padding: 8px 8px 0;
  }

  .seg {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface-2);
    margin-right: 2px;
  }

  .seg button {
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-2);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .seg button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgb(20 26 32 / 0.15);
  }

  .write {
    padding: 0 10px;
    color: var(--accent);
    border-radius: 999px;
  }

  .write.on {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  @media (max-width: 520px) {
    .wl {
      display: none;
    }
    .write {
      width: 40px;
      padding: 0;
    }
  }

  .review {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: var(--warn);
  }

  .result {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    font-weight: 650;
    font-size: 1.05rem;
    background: var(--danger-soft);
    color: var(--danger);
  }

  .result.right {
    background: var(--ok-soft);
    color: var(--ok);
  }

  .explain {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label-h {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ref {
    margin: 6px 0 0;
  }

  .notes {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 4px;
  }

  .notes h2 {
    margin: 0;
  }

  .notes textarea {
    min-height: 4.5em;
  }

  .bottom {
    position: fixed;
    z-index: 20;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .bottom-inner {
    max-width: var(--page-max);
    margin: 0 auto;
    display: flex;
    gap: 10px;
    padding: 10px 16px;
  }

  .nav {
    width: 52px;
    height: 52px;
    padding: 0;
    flex: none;
    color: var(--accent);
  }

  .big {
    flex: 1;
    height: 52px;
    font-size: 1.05rem;
    font-weight: 650;
  }
</style>
