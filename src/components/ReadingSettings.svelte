<script lang="ts">
  // Font, text size and page colour. Font and colour are saved with your data, so every
  // device uses them; text size is set on each device, since screens differ.
  import { FONTS, SIZES, THEMES, sizeIndex, type FontKey, type ThemeKey } from '../lib/appearance';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import Icon from './Icon.svelte';

  let { preview = true }: { preview?: boolean } = $props();

  const font = $derived(store.settings.font ?? 'default');
  const theme = $derived(store.settings.theme);
  const step = $derived(sizeIndex(ui.textScale));

  function setFont(key: FontKey) {
    if (key !== font) void store.saveSettings({ font: key });
  }

  function setTheme(key: ThemeKey) {
    if (key !== theme) void store.saveSettings({ theme: key });
  }

  function setStep(i: number) {
    ui.setTextScale(SIZES[Math.min(Math.max(i, 0), SIZES.length - 1)]);
  }
</script>

<div class="reading">
  <div class="group">
    <h3 class="cap">Font</h3>
    <div class="fonts" role="group" aria-label="Font">
      {#each FONTS as f (f.key)}
        <button type="button" class="font" class:on={font === f.key} aria-pressed={font === f.key} onclick={() => setFont(f.key)}>
          <span class="aa" style:font-family={f.question}>Aa</span>
          <span class="fname" style:font-family={f.body}>{f.label}</span>
        </button>
      {/each}
    </div>
    {#if font === 'default'}<p class="small muted m0">Default: serif questions with sans-serif answers, as before.</p>{/if}
  </div>

  <div class="group">
    <div class="row between">
      <h3 class="cap">Text size</h3>
      <span class="small muted">{Math.round(SIZES[step] * 100)}%{step === SIZES.indexOf(1) ? ' (normal)' : ''}</span>
    </div>
    <div class="size">
      <button type="button" class="btn icon sz" aria-label="Smaller text" disabled={step === 0} onclick={() => setStep(step - 1)}><span class="a-small">A</span></button>
      <input type="range" min="0" max={SIZES.length - 1} step="1" value={step} aria-label="Text size" aria-valuetext="{Math.round(SIZES[step] * 100)}%" oninput={(e) => setStep(Number(e.currentTarget.value))} />
      <button type="button" class="btn icon sz" aria-label="Larger text" disabled={step === SIZES.length - 1} onclick={() => setStep(step + 1)}><span class="a-big">A</span></button>
    </div>
    <p class="small muted m0">Text size is set on each device. Font and colours apply on all your devices.</p>
  </div>

  <div class="group">
    <h3 class="cap">Background</h3>
    {#each [['kindle', 'Kindle colours'], ['app', 'App colours']] as [group, title] (group)}
      <div class="sub small muted">{title}</div>
      <div class="swatches" role="group" aria-label={title}>
        {#each THEMES.filter((t) => t.group === group) as t (t.key)}
          <button type="button" class="swatch" class:on={theme === t.key} aria-pressed={theme === t.key} onclick={() => setTheme(t.key)}>
            <span class="chip" style:background={t.swatch.bg} style:color={t.swatch.text}>
              {#if theme === t.key}<Icon name="check" size={18} />{:else if t.key !== 'system'}Aa{/if}
            </span>
            <span class="sname">{t.label}</span>
          </button>
        {/each}
      </div>
    {/each}
  </div>

  {#if preview}
    <div class="group">
      <h3 class="cap">Preview</h3>
      <div class="preview" aria-hidden="true">
        <p class="pq">A team wants to send a welcome email when a customer first opts in. What should the consultant do?</p>
        <div class="po on"><span class="pn">1</span><span>Use a flow triggered by the consent record.</span></div>
        <div class="po"><span class="pn">2</span><span>Send a one-time email to all contacts.</span></div>
        <p class="pe">Explanation text, notes and links use the same font and size.</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .reading {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  .fonts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .font {
    min-height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 6px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
  }

  .font.on {
    border: 2px solid var(--accent);
    background: var(--accent-soft);
  }

  .aa {
    font-size: 1.35rem;
    line-height: 1.1;
  }

  .fname {
    font-size: 0.8rem;
    color: var(--text-2);
  }

  .font.on .fname {
    color: var(--accent);
    font-weight: 600;
  }

  .size {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .size input {
    flex: 1;
    min-height: 0;
    padding: 0;
    border: 0;
    background: none;
    accent-color: var(--accent);
  }

  .sz {
    width: 44px;
    height: 44px;
    flex: none;
  }

  .a-small {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .a-big {
    font-size: 1.35rem;
    font-weight: 600;
  }

  .sub {
    margin-top: 2px;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 64px;
    padding: 4px;
    border: 0;
    background: none;
    color: var(--text);
  }

  .chip {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-serif);
    font-size: 1.05rem;
    border: 1px solid var(--border);
  }

  .swatch.on .chip {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 4px var(--accent);
  }

  .sname {
    font-size: 0.8rem;
  }

  .swatch.on .sname {
    font-weight: 650;
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--paper);
    font-family: var(--read-body);
  }

  .pq {
    margin: 0;
    font-family: var(--read-q);
    font-size: calc(17px * var(--read-scale));
    line-height: 1.5;
  }

  .po {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 10px;
    border: 2px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    font-size: calc(15px * var(--read-scale));
  }

  .po.on {
    border-color: var(--ok);
    background: var(--ok-soft);
  }

  .pn {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font);
    font-size: 12px;
    font-weight: 700;
    background: var(--surface-2);
  }

  .po.on .pn {
    background: var(--ok);
    color: var(--accent-contrast);
  }

  .pe {
    margin: 0;
    color: var(--text-2);
    font-size: calc(0.9rem * var(--read-scale));
  }
</style>
