<script lang="ts">
  // Handwriting over a page. Sits inside a box laid out in page units (`width`
  // wide, scaled to the screen), so strokes stay in place on every device.
  // `left`/`right` extend the writing area past the box's sides (the margins
  // beside the question); strokes there are stored at negative x or past the width.
  // With "Pencil only", fingers and palms scroll and never draw.
  import { addPoint, newStroke, strokePath, touches } from '../lib/ink';
  import { PAGE_WIDTH, type Stroke } from '../lib/types';
  import { ui } from '../lib/ui.svelte';

  let {
    strokes,
    active,
    onchange,
    label,
    width = PAGE_WIDTH,
    left = 0,
    right = 0,
  }: {
    strokes: Stroke[];
    active: boolean;
    onchange: (next: Stroke[]) => void;
    label: string;
    width?: number;
    left?: number;
    right?: number;
  } = $props();

  let svg: SVGSVGElement | undefined = $state();
  let current = $state<Stroke | null>(null);
  let pointerId: number | null = null;
  // Strokes as they were when the eraser went down, and what it has removed so far.
  let erasing: { before: Stroke[]; left: Stroke[] } | null = null;
  let shown = $state<Stroke[] | null>(null);

  const visible = $derived(shown ?? strokes);
  const paths = $derived(visible.map((s) => ({ s, d: strokePath(s) })));
  const livePath = $derived(current ? strokePath(current, true) : '');

  function point(e: PointerEvent): [number, number, number] {
    const rect = svg!.getBoundingClientRect();
    const scale = rect.width / (width + left + right) || 1;
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
    return [(e.clientX - rect.left) / scale - left, (e.clientY - rect.top) / scale, pressure];
  }

  function allowed(e: PointerEvent) {
    return !(e.pointerType === 'touch' && ui.pencilOnly);
  }

  function commit(before: Stroke[], after: Stroke[]) {
    onchange(after);
    ui.record({ undo: () => onchange(before), redo: () => onchange(after) });
  }

  function erase(x: number, y: number) {
    if (!erasing) return;
    const left = erasing.left.filter((s) => !touches(s, x, y, 8));
    if (left.length !== erasing.left.length) {
      erasing.left = left;
      shown = left;
    }
  }

  function down(e: PointerEvent) {
    if (!active || !allowed(e) || pointerId !== null || e.button > 0) return;
    e.preventDefault();
    pointerId = e.pointerId;
    svg!.setPointerCapture(e.pointerId);
    const [x, y, p] = point(e);
    if (ui.tool === 'eraser') {
      erasing = { before: strokes, left: strokes };
      erase(x, y);
    } else {
      const s = newStroke(ui.tool, ui.color);
      addPoint(s, x, y, p);
      current = s;
    }
  }

  function move(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e]) {
      const [x, y, p] = point(ev);
      if (erasing) erase(x, y);
      else if (current) addPoint(current, x, y, p);
    }
  }

  function up(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (erasing) {
      const { before, left } = erasing;
      erasing = null;
      shown = null;
      if (left.length !== before.length) commit(before, left);
    } else if (current) {
      const done = $state.snapshot(current) as Stroke;
      current = null;
      if (done.pts.length) commit(strokes, [...strokes, done]);
    }
  }

  // Apple Pencil: stop the page scrolling under the pencil while fingers still scroll it.
  $effect(() => {
    if (!svg || !active) return;
    const el = svg;
    const block = (e: TouchEvent) => {
      const stylus = [...e.touches].some((t) => (t as Touch & { touchType?: string }).touchType === 'stylus');
      if (stylus || !ui.pencilOnly) e.preventDefault();
    };
    el.addEventListener('touchstart', block, { passive: false });
    el.addEventListener('touchmove', block, { passive: false });
    return () => {
      el.removeEventListener('touchstart', block);
      el.removeEventListener('touchmove', block);
    };
  });
</script>

<svg
  bind:this={svg}
  class="ink"
  class:active
  class:finger={active && !ui.pencilOnly}
  role={active ? 'application' : 'img'}
  aria-label={label}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  style:left="{-left}px"
  style:width="calc(100% + {left + right}px)"
>
  <g transform="translate({left} 0)">
    {#each paths as p, i (i)}
      <path d={p.d} class="s {p.s.tool} c-{p.s.color}" />
    {/each}
    {#if current && livePath}
      <path d={livePath} class="s {current.tool} c-{current.color}" />
    {/if}
  </g>
</svg>

<style>
  .ink {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
    z-index: 2;
  }

  .ink.active {
    pointer-events: auto;
    touch-action: pan-x pan-y;
    cursor: crosshair;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .ink.finger {
    touch-action: none;
  }

  .s {
    fill: var(--ink-ink);
  }

  .marker {
    opacity: 0.38;
  }

  .c-ink {
    fill: var(--ink-ink);
  }
  .c-blue {
    fill: var(--ink-blue);
  }
  .c-red {
    fill: var(--ink-red);
  }
  .c-green {
    fill: var(--ink-green);
  }
  .c-yellow {
    fill: var(--ink-yellow);
  }
  .c-pink {
    fill: var(--ink-pink);
  }
</style>
