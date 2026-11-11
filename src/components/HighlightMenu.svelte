<script lang="ts">
  // Select text in the question, an option or the explanation, then tap
  // Highlight (or Remove) in the small menu that appears above the selection.
  import { addMark, overlapsMark, removeMark } from '../lib/marks';
  import { store } from '../lib/store.svelte';
  import type { MarkField, MarkRange, Question } from '../lib/types';
  import Icon from './Icon.svelte';

  let { question, enabled, root }: { question: Question; enabled: boolean; root: HTMLElement | undefined } = $props();

  /** Height of the menu: a small button plus padding. */
  const MENU_HEIGHT = 46;
  /** Room for the Copy / Look Up bar that iPadOS and iOS show next to selected text. */
  const SYSTEM_BAR = 64;

  let pending = $state<MarkRange | null>(null);
  let pos = $state({ x: 0, y: 0 });

  const ranges = $derived(store.marks.get(question.id)?.ranges ?? []);
  const overlaps = $derived(pending ? overlapsMark(ranges, pending) : false);

  function fieldOf(node: Node | null): HTMLElement | null {
    const el = node instanceof HTMLElement ? node : node?.parentElement;
    return (el?.closest('[data-field]') as HTMLElement | null) ?? null;
  }

  /** Characters from the start of `field` to a point in it. */
  function offset(field: HTMLElement, node: Node, at: number): number {
    const r = document.createRange();
    r.selectNodeContents(field);
    r.setEnd(node, at);
    return r.toString().length;
  }

  function read() {
    pending = null;
    if (!enabled || !root) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const a = fieldOf(range.startContainer);
    const b = fieldOf(range.endContainer);
    // Only within one piece of text (highlights don't cross from the question into an option).
    if (!a || a !== b || !root.contains(a)) return;
    const s = offset(a, range.startContainer, range.startOffset);
    const e = offset(a, range.endContainer, range.endOffset);
    if (e <= s) return;
    pending = { f: a.dataset.field as MarkField, s, e };
    // Above the first line of the selection, where the writing hand doesn't cover it; below
    // the last line only when there's no room above (under the top bar). On iPad and phones
    // it keeps clear of the system's own Copy / Look Up bar, which sits right by the selection.
    const rects = range.getClientRects();
    const box = range.getBoundingClientRect();
    const first = rects[0] ?? box;
    const last = rects[rects.length - 1] ?? box;
    const barBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 56;
    const gap = navigator.maxTouchPoints > 0 ? SYSTEM_BAR : 10;
    let y = first.top - MENU_HEIGHT - gap;
    if (y < barBottom + 6) y = last.bottom + gap;
    pos = { x: Math.min(Math.max(box.left + box.width / 2, 90), window.innerWidth - 90), y: Math.min(y, window.innerHeight - MENU_HEIGHT - 16) };
  }

  $effect(() => {
    if (!enabled) {
      pending = null;
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(read, 120);
    };
    document.addEventListener('selectionchange', onChange);
    window.addEventListener('scroll', onChange, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onChange);
      window.removeEventListener('scroll', onChange);
    };
  });

  async function apply(remove: boolean) {
    if (!pending) return;
    const next = remove ? removeMark(ranges, pending) : addMark(ranges, pending);
    pending = null;
    window.getSelection()?.removeAllRanges();
    await store.saveMarks(question, next);
  }
</script>

{#if pending}
  <div class="menu" data-floating style:left="{pos.x}px" style:top="{pos.y}px" role="toolbar" aria-label="Highlight">
    <!-- pointerdown is cancelled so tapping the menu doesn't clear the selection first -->
    <button type="button" class="btn small primary" onpointerdown={(e) => e.preventDefault()} onclick={() => apply(false)}>
      <Icon name="highlight" size={16} /> Highlight
    </button>
    {#if overlaps}
      <button type="button" class="btn small" onpointerdown={(e) => e.preventDefault()} onclick={() => apply(true)}>Remove</button>
    {/if}
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    z-index: 50;
    translate: -50% 0;
    display: flex;
    gap: 6px;
    padding: 6px;
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
  }
</style>
