<script lang="ts">
  // A handwritten memo page for one question. Laid out in page units and scaled
  // to the available width, so a memo looks the same on every device.
  import { inkBottom } from '../lib/ink';
  import { store } from '../lib/store.svelte';
  import { MEMO_WIDTH, PAGE_WIDTH, type Question, type Stroke } from '../lib/types';
  import { ui } from '../lib/ui.svelte';
  import Icon from './Icon.svelte';
  import InkLayer from './InkLayer.svelte';

  let { question }: { question: Question } = $props();

  const ink = $derived(store.inkFor(question.id, 'memo'));
  // Memos written before pads were wide keep their original width, so nothing moves.
  const padWidth = $derived(ink ? (ink.width ?? PAGE_WIDTH) : MEMO_WIDTH);
  const START_HEIGHT = $derived(Math.round(padWidth * 0.6));
  const MORE = $derived(Math.round(padWidth * 0.35));
  const strokes = $derived(ink?.strokes ?? []);
  const height = $derived(Math.max(ink?.height ?? START_HEIGHT, inkBottom(strokes) + 40));

  let width = $state(0);
  const scale = $derived(width ? width / padWidth : 1);

  function save(next: Stroke[]) {
    // Writing near the bottom makes room for more.
    const h = inkBottom(next) > height - 50 ? height + MORE : height;
    void store.saveInk(question, 'memo', { strokes: next, height: h, width: padWidth });
  }

  function moreSpace() {
    void store.saveInk(question, 'memo', { strokes, height: height + MORE, width: padWidth });
  }
</script>

<div class="memo">
  <div class="pad" bind:clientWidth={width} style:height="{height * scale}px">
    <div class="inner" style:width="{padWidth}px" style:transform="scale({scale})" style:height="{height}px">
      <InkLayer {strokes} active={ui.writing} onchange={save} label="Handwritten memo" width={padWidth} />
    </div>
    {#if strokes.length === 0 && !ui.writing}
      <p class="hint">Tap <strong>Write</strong> to add a handwritten memo.</p>
    {/if}
  </div>
  <div class="row foot">
    <span class="small muted">{ui.pencilOnly ? 'Apple Pencil writes; your finger scrolls.' : 'Pencil, finger or mouse all write.'}</span>
    <button type="button" class="btn small" onclick={moreSpace}><Icon name="plus" size={16} /> More space</button>
  </div>
</div>

<style>
  .memo {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pad {
    position: relative;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--paper);
  }

  .inner {
    position: relative;
    background-size: 22px 22px;
    transform-origin: top left;
    background-image: radial-gradient(var(--border) 1px, transparent 1px);
  }

  .hint {
    position: absolute;
    left: 0;
    right: 0;
    top: 40%;
    margin: 0;
    text-align: center;
    color: var(--text-2);
    font-size: 0.9rem;
    pointer-events: none;
  }

  .foot {
    justify-content: space-between;
  }
</style>
