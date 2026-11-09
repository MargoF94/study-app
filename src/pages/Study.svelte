<script lang="ts">
  import HighlightMenu from '../components/HighlightMenu.svelte';
  import Icon from '../components/Icon.svelte';
  import InkToolbar from '../components/InkToolbar.svelte';
  import Linkified from '../components/Linkified.svelte';
  import MarkedText from '../components/MarkedText.svelte';
  import MemoPad from '../components/MemoPad.svelte';
  import QuestionPage from '../components/QuestionPage.svelte';
  import ReadingSettings from '../components/ReadingSettings.svelte';
  import LinkRow from '../components/LinkRow.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { ORIGINAL_STYLE, fontOption, sameStyle, styleForInk, type TextStyle } from '../lib/appearance';
  import { layoutFor } from '../lib/layout';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { isRight, recordAnswer } from '../lib/study';
  import { PAGE_WIDTH, type Question, type Stroke } from '../lib/types';
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
  const pageInk = $derived(question ? store.inkFor(question.id, 'page') : undefined);
  const pageStrokes = $derived(pageInk?.strokes ?? []);

  // The reading column (Clean mode's width). On iPads and computers the question page is
  // laid out wide and fills exactly this width in every mode.
  let columnWidth = $state(0);
  let viewportWidth = $state(0);
  const layoutWidth = $derived(layoutFor(columnWidth || viewportWidth - 32));

  // Handwriting on a question stays on its words: the question keeps the layout, font and
  // size it was written on, even after they change (until you choose otherwise).
  const currentStyle = $derived<TextStyle>({ font: fontOption(store.settings.font).key, scale: ui.textScale, width: layoutWidth });
  const pinnedStyle = $derived(pageStrokes.length ? (pageInk?.style ?? ORIGINAL_STYLE) : undefined);
  const keptOldStyle = $derived(!!pinnedStyle && !sameStyle(pinnedStyle, currentStyle));
  const pageStyle = $derived(ui.notes && pinnedStyle ? pinnedStyle : currentStyle);

  let showReading = $state(false);

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
    if (!question) return;
    const before = store.inkFor(question.id, 'page');
    void store.saveInk(question, 'page', { strokes: next, style: styleForInk(before, next.length, currentStyle) });
  }

  function useCurrentStyle() {
    if (!question || !confirm('Show this question in the current layout, font and size? Your handwriting on it may no longer line up with the words.')) return;
    void store.saveInk(question, 'page', { strokes: pageStrokes, style: currentStyle });
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape' && showReading) {
      showReading = false;
      return;
    }
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key) && question && Number(e.key) <= question.options.length) choose(Number(e.key) - 1);
    else if (e.key === 'Enter' && !checked && !t.closest('button, a, [role=radio], [role=checkbox]')) void check();
    else if (e.key === 'ArrowRight') void go(1);
    else if (e.key === 'ArrowLeft') void go(-1);
  }

  const qLinks = $derived(question ? store.linksFor(question) : []);
  const examLinkCount = $derived(store.linksOf(examId).filter((l) => !l.questionId).length);
  // Links may give the answer away: in Clean mode they appear once the answer is checked.
  const showLinks = $derived(!!question && (ui.notes || (checked && (qLinks.length > 0 || examLinkCount > 0))));

  const atEnd = $derived(index >= total - 1);
  const correctLabel = $derived(question ? question.correct.map((i) => i + 1).join(' and ') : '');
</script>

<svelte:window onkeydown={onkey} bind:innerWidth={viewportWidth} />

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
      <button type="button" class="btn ghost icon aa-btn" class:on={showReading} aria-pressed={showReading} aria-label="Text and colours" title="Text and colours" onclick={() => (showReading = !showReading)}>
        <span class="aa-label">Aa</span>
      </button>
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

  {#if showReading}
    <button type="button" class="reading-backdrop" aria-label="Close text and colours" onclick={() => (showReading = false)}></button>
    <div class="reading-panel card" role="dialog" aria-label="Text and colours">
      <div class="row between">
        <h2 class="m0">Text and colours</h2>
        <button type="button" class="btn ghost icon" aria-label="Close" onclick={() => (showReading = false)}><Icon name="close" /></button>
      </div>
      <ReadingSettings preview={false} />
    </div>
  {/if}

  <div class="page-body study" class:wide={ui.notes} bind:this={root}>
    <div class="ruler" bind:clientWidth={columnWidth} aria-hidden="true"></div>
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
        textStyle={pageStyle}
        fixed={ui.notes || layoutWidth !== PAGE_WIDTH}
        column={columnWidth}
      />

      {#if ui.notes && keptOldStyle}
        <p class="kept small">
          <Icon name="info" size={17} />
          <span>This question keeps the layout your handwriting was written on, so it stays on the right words.
            <button type="button" class="linkish" onclick={useCurrentStyle}>Use the current layout</button></span>
        </p>
      {/if}

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

      {#if showLinks && question}
        <section class="card qlinks">
          <div class="lhead">
            <h2 class="m0">Links <span class="small muted">· this question</span></h2>
            <a class="btn small" href="#/link/new?exam={examId}&q={question.id}"><Icon name="plus" size={17} /> Add link</a>
          </div>
          {#each qLinks as l (l.id)}
            <LinkRow link={l} />
          {:else}
            <p class="small muted none">No links on this question yet.</p>
          {/each}
          <a class="examlinks" href="#/exam/{examId}/links">
            <span>{examLinkCount ? `Exam links (${examLinkCount})` : 'All links in this exam'}</span>
            <Icon name="next" size={18} />
          </a>
        </section>
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

  /* Floating things (the Highlight button) are placed by themselves and are left out. */
  .study.wide > :global(*:not(.frame):not(.notes):not([data-floating])) {
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

  /* Reading text follows Settings → Reading. */
  .explain p,
  .notes textarea {
    font-family: var(--read-body);
    font-size: calc(1rem * var(--read-scale));
  }

  .explain .ref {
    font-size: calc(0.875rem * var(--read-scale));
  }

  /* Measures the reading column; takes no space. */
  .ruler {
    height: 0;
    margin-bottom: -14px;
  }

  .kept {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: -4px 0 0;
    color: var(--text-2);
  }

  .kept :global(svg) {
    margin-top: 2px;
  }

  .linkish {
    border: 0;
    padding: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
  }

  .aa-btn.on {
    background: var(--accent-soft);
  }

  .aa-label {
    font-family: var(--font-serif);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--accent);
  }

  /* On phones the top bar is full: text settings are in Settings → Reading there. */
  @media (max-width: 600px) {
    .aa-btn {
      display: none;
    }
  }

  .reading-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    border: 0;
    background: rgb(0 0 0 / 0.2);
  }

  .reading-panel {
    position: fixed;
    z-index: 41;
    top: calc(64px + env(safe-area-inset-top));
    right: max(12px, calc((100vw - var(--page-max)) / 2));
    width: min(420px, calc(100vw - 24px));
    max-height: calc(100dvh - 90px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 8px 30px rgb(0 0 0 / 0.25);
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

  .qlinks {
    padding: 0;
    overflow: hidden;
  }

  .lhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px 6px 16px;
  }

  .none {
    margin: 0;
    padding: 4px 16px 12px;
  }

  .examlinks {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 46px;
    padding: 0 16px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--accent);
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: none;
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
