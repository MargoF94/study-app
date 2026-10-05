<script lang="ts">
  // The question and its options. In Notes mode it is laid out at a fixed page
  // width (PAGE_WIDTH) and scaled to the screen, so handwriting over it stays on
  // the same words on a phone, an iPad or a computer. Nothing in it changes size
  // when the answer is checked, for the same reason.
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
  } = $props();

  const MAX_SCALE = 1.4;
  let width = $state(0);
  let innerHeight = $state(0);
  const scale = $derived(width ? Math.min(width / PAGE_WIDTH, MAX_SCALE) : 1);
  const multi = $derived(question.correct.length > 1);

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

<div class="frame" class:fixed={notes} bind:clientWidth={width} style:height={notes ? `${innerHeight * scale}px` : undefined}>
  <div
    class="page"
    bind:offsetHeight={innerHeight}
    style:width={notes ? `${PAGE_WIDTH}px` : undefined}
    style:transform={notes ? `scale(${scale})` : undefined}
    style:margin-left={notes && width > PAGE_WIDTH * scale ? `${(width - PAGE_WIDTH * scale) / 2}px` : undefined}
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
      <InkLayer {strokes} active={writing} onchange={onink} label="Handwriting on the question" />
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
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 1.55;
  }

  .choose {
    margin: -4px 0 0;
    font-size: 13px;
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
    font-size: 15px;
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
    font-size: clamp(17px, 1rem + 0.5vw, 21px);
  }
  .frame:not(.fixed) .opt {
    font-size: clamp(15px, 0.9rem + 0.3vw, 18px);
  }
</style>
