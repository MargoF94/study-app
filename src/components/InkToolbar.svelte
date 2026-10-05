<script lang="ts">
  // Pen, highlighter, eraser, colours, undo/redo and the Pencil-only switch.
  import { COLOR_NAMES, MARKER_COLORS, PEN_COLORS } from '../lib/ink';
  import { ui, type Tool } from '../lib/ui.svelte';
  import Icon from './Icon.svelte';

  const TOOLS: { tool: Tool; icon: string; label: string }[] = [
    { tool: 'pen', icon: 'pen', label: 'Pen' },
    { tool: 'marker', icon: 'marker', label: 'Highlighter' },
    { tool: 'eraser', icon: 'eraser', label: 'Eraser' },
  ];

  const colors = $derived(ui.tool === 'marker' ? MARKER_COLORS : PEN_COLORS);
  const current = $derived(ui.tool === 'marker' ? ui.markerColor : ui.tool === 'pen' ? ui.penColor : null);
</script>

<div class="bar" role="toolbar" aria-label="Handwriting tools">
  <div class="group">
    {#each TOOLS as t (t.tool)}
      <button type="button" class="tb" class:on={ui.tool === t.tool} aria-pressed={ui.tool === t.tool} aria-label={t.label} title={t.label} onclick={() => (ui.tool = t.tool)}>
        <Icon name={t.icon} size={21} />
      </button>
    {/each}
  </div>
  <div class="group">
    {#each colors as c (c)}
      <button type="button" class="tb swatch" aria-pressed={current === c} aria-label={COLOR_NAMES[c]} title={COLOR_NAMES[c]} onclick={() => ui.setColor(c)}>
        <span class="dot c-{c}" class:on={current === c} class:marker={ui.tool === 'marker'}></span>
      </button>
    {/each}
  </div>
  <div class="group">
    <button type="button" class="tb" aria-label="Undo" title="Undo" disabled={!ui.canUndo} onclick={() => ui.undo()}><Icon name="undo" /></button>
    <button type="button" class="tb" aria-label="Redo" title="Redo" disabled={!ui.canRedo} onclick={() => ui.redo()}><Icon name="redo" /></button>
  </div>
  <div class="group">
    <button type="button" class="chip-btn" class:on={ui.pencilOnly} aria-pressed={ui.pencilOnly} onclick={() => ui.setPencilOnly(!ui.pencilOnly)}>
      {ui.pencilOnly ? 'Pencil only' : 'Pencil + finger'}
    </button>
    <button type="button" class="btn primary small done" onclick={() => (ui.writing = false)}>Done</button>
  </div>
</div>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 6px;
    padding: 4px 8px;
    margin: 0 auto;
    width: fit-content;
    max-width: 100%;
    border-radius: 22px;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
  }

  .group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .group + .group {
    padding-left: 6px;
    border-left: 1px solid var(--border);
  }

  .tb {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--accent);
  }

  .tb.on {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .tb:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }

  .dot.marker {
    opacity: 0.6;
  }

  .dot.on {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 4px var(--text-2);
  }

  .c-ink {
    background: var(--ink-ink);
  }
  .c-blue {
    background: var(--ink-blue);
  }
  .c-red {
    background: var(--ink-red);
  }
  .c-green {
    background: var(--ink-green);
  }
  .c-yellow {
    background: var(--ink-yellow);
  }
  .c-pink {
    background: var(--ink-pink);
  }

  .chip-btn {
    height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-2);
    font-size: 0.82rem;
    font-weight: 600;
  }

  .chip-btn.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }

  .done {
    margin-left: 4px;
    border-radius: 999px;
  }
</style>
