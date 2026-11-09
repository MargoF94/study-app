<script lang="ts">
  // The question and its options, laid out at a fixed page width (textStyle.width, in page
  // units) and scaled to the screen, so handwriting over it stays on the same words on a
  // phone, an iPad or a computer. On iPads and computers the page is used in every mode
  // (`fixed`), so Clean, Notes and Write look exactly the same; phones reflow the text in
  // Clean mode. Nothing changes size when the answer is checked, for the same reason.
  // A question with handwriting keeps the style it was written on (textStyle).
  import { fontOption, type TextStyle } from '../lib/appearance';
  import { pageGeometry } from '../lib/layout';
  import { PAGE_WIDTH, type MarkRange, type Question, type Stroke } from '../lib/types';
  import Icon from './Icon.svelte';
  import InkLayer from './InkLayer.svelte';
  import MarkedText from './MarkedText.svelte';

  let {
    question,
    chosen,
    checked,
    onchoose,
    notes,
    writing,
    ranges,
    strokes,
    onink,
    textStyle,
    fixed,
    column,
  }: {
    question: Question;
    chosen: number[];
    checked: boolean;
    onchoose: (i: number) => void;
    notes: boolean;
    writing: boolean;
    ranges: MarkRange[];
    strokes: Stroke[];
    onink: (s: Stroke[]) => void;
    /** Font, text size and page width to lay the page out in. */
    textStyle: TextStyle;
    /** Laid out at the fixed page width (always on iPads and computers; in Notes mode on phones). */
    fixed: boolean;
    /** Width of the reading column (Clean mode's width), which a wide page fills. */
    column: number;
  } = $props();

  const font = $derived(fontOption(textStyle.font));
  const layout = $derived(textStyle.width ?? PAGE_WIDTH);
  let width = $state(0);
  let innerHeight = $state(0);
  const geo = $derived(pageGeometry(layout, width, column));
  const scale = $derived(width ? geo.scale : 1);
  const multi = $derived(question.correct.length > 1);
  /** Free space beside the page, in page units: writable too. */
  const margin = $derived(notes && width ? geo.margin : 0);

  function optState(i: number): 'right' | 'wrong' | 'missed' | 'chosen' | '' {
    const isChosen = chosen.includes(i);
    const isCorrect = question.correct.includes(i);
    if (!checked) return isChosen ? 'chosen' : '';
    if (isCorrect) return isChosen ? 'right' : 'missed';
    return isChosen ? 'wrong' : '';
  }

  const STATUS = { right: 'Correct answer, your answer', missed: 'Correct answer', wrong: 'Your answer, not correct', chosen: 'Selected', '': '' };

  function click(i: number) {
    // Selecting text inside an option (to highlight it) shouldn't also choose the option.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return;
    onchoose(i);
  }

  function key(e: KeyboardEvent, i: number) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onchoose(i);
    }
  }
</script>

<div class="frame" class:fixed bind:clientWidth={width} style:height={fixed ? `${innerHeight * scale}px` : undefined}>
  <div
    class="page"
    bind:offsetHeight={innerHeight}
    style:width={fixed ? `${layout}px` : undefined}
    style:transform={fixed ? `scale(${scale})` : undefined}
    style:margin-left={fixed && geo.offset > 0 ? `${geo.offset}px` : undefined}
    style:--page-q={font.question}
    style:--page-body={font.body}
    style:--page-scale={String(textStyle.scale)}
  >
    {#if question.topic}<span class="topic">{question.topic}</span>{/if}
    <p class="qtext"><MarkedText text={question.text} field="q" {ranges} show={notes} /></p>
    {#if multi}<p class="choose">Choose {question.correct.length}</p>{/if}
    <div class="options" role={multi ? 'group' : 'radiogroup'} aria-label="Answer options">
      {#each question.options as opt, i (i)}
        {@const st = optState(i)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (role is radio or checkbox) -->
        <div
          class="opt {st}"
          role={multi ? 'checkbox' : 'radio'}
          aria-checked={chosen.includes(i)}
          aria-disabled={checked}
          tabindex="0"
          onclick={() => click(i)}
          onkeydown={(e) => key(e, i)}
        >
          <span class="num">{i + 1}</span>
          <span class="otext"><MarkedText text={opt} field={`o${i}`} {ranges} show={notes} /></span>
          <span class="status">
            {#if st === 'right' || st === 'missed'}<Icon name="check" size={18} />{:else if st === 'wrong'}<Icon name="close" size={18} />{/if}
            {#if STATUS[st]}<span class="visually-hidden">{STATUS[st]}</span>{/if}
          </span>
        </div>
      {/each}
    </div>
    {#if notes}
      <InkLayer {strokes} active={writing} onchange={onink} label="Handwriting on the question" left={margin} right={margin} />
    {/if}
  </div>
</div>

<style>
  .frame {
    position: relative;
  }

  .frame.fixed {
    overflow: visible;
  }

  .page {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 18px 20px;
    background: var(--paper);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow);
    transform-origin: top left;
    font-family: var(--page-body, var(--read-body));
  }

  .fixed .page {
    box-sizing: border-box;
  }

  .topic {
    align-self: flex-start;
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-soft);
    border-radius: 999px;
    padding: 3px 10px;
  }

  .qtext {
    margin: 0;
    font-family: var(--page-q, var(--read-q));
    font-size: calc(17px * var(--page-scale, var(--read-scale)));
    line-height: 1.55;
  }

  .choose {
    margin: -4px 0 0;
    font-size: calc(13px * var(--page-scale, var(--read-scale)));
    font-weight: 650;
    color: var(--text-2);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .opt {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) 20px;
    align-items: start;
    gap: 10px;
    padding: 10px 10px 10px 11px;
    border: 2px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    font-size: calc(15px * var(--page-scale, var(--read-scale)));
    line-height: 1.45;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .opt:hover {
    border-color: var(--text-2);
  }

  .opt[aria-disabled='true'] {
    cursor: default;
  }

  .num {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    background: var(--surface-2);
    -webkit-user-select: none;
    user-select: none;
  }

  .status {
    display: flex;
    justify-content: center;
    padding-top: 3px;
  }

  .opt.chosen {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .opt.chosen .num {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .opt.right,
  .opt.missed {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .opt.right .num,
  .opt.missed .num {
    background: var(--ok);
    color: var(--accent-contrast);
  }
  .opt.right .status,
  .opt.missed .status {
    color: var(--ok);
  }
  .opt.missed {
    border-style: dashed;
  }

  .opt.wrong {
    border-color: var(--danger);
    background: var(--danger-soft);
  }
  .opt.wrong .num {
    background: var(--danger);
    color: var(--accent-contrast);
  }
  .opt.wrong .status {
    color: var(--danger);
  }

  /* Clean mode: normal text that fits the screen, a little larger on big screens. */
  .frame:not(.fixed) .qtext {
    font-size: calc(clamp(17px, 1rem + 0.5vw, 21px) * var(--read-scale));
  }
  .frame:not(.fixed) .opt {
    font-size: calc(clamp(15px, 0.9rem + 0.3vw, 18px) * var(--read-scale));
  }
</style>
