<script lang="ts">
  // Your answers to this question: a count, and with the switch on, each answer (newest first)
  // with when it was and whether it was right. Which options you chose shows once you've
  // checked your answer, so the list never gives the answer away. The switch stays as you
  // leave it, on this device.
  import { answerHistory } from '../lib/study';
  import type { Progress } from '../lib/types';
  import { ui } from '../lib/ui.svelte';
  import { plural } from '../lib/util';
  import Icon from './Icon.svelte';

  let { progress, checked }: { progress: Progress | undefined; checked: boolean } = $props();

  const history = $derived(answerHistory(progress));
  const total = $derived(progress?.attempts ?? 0);
  const anyChosen = $derived(history.answers.some((a) => a.chosen.length > 0));

  const thisYear = new Date().getFullYear();
  function when(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      ...(d.getFullYear() === thisYear ? {} : { year: 'numeric' }),
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  const options = (chosen: number[]) => chosen.map((i) => i + 1).join(' and ');
</script>

<section class="card answers" aria-label="Your answers to this question">
  <label class="head">
    <Icon name="history" size={20} />
    <span class="sum">
      <strong>Your answers</strong>
      <span class="small muted">{total ? `${plural(total, 'time')} · ${progress?.right ?? 0} right` : 'not answered yet'}</span>
    </span>
    <span class="switch">
      <input type="checkbox" role="switch" checked={ui.showHistory} onchange={(e) => ui.setShowHistory(e.currentTarget.checked)} />
      <span class="track" aria-hidden="true"><span class="thumb"></span></span>
      <span class="visually-hidden">Show your answers</span>
    </span>
  </label>

  {#if ui.showHistory}
    {#if history.answers.length}
      <ol class="list">
        {#each history.answers as a, i (i)}
          <li class:right={a.right}>
            <span class="mark"><Icon name={a.right ? 'check' : 'close'} size={16} /></span>
            <span class="what">{a.right ? 'Right' : 'Wrong'}{checked && a.chosen.length ? ` · you chose ${options(a.chosen)}` : ''}</span>
            <span class="when small muted">{when(a.at)}</span>
          </li>
        {/each}
      </ol>
      {#if history.other}
        <p class="small muted note">And {plural(history.other, 'earlier answer')} ({history.otherRight} right), from before each answer was kept.</p>
      {/if}
      {#if !checked && anyChosen}
        <p class="small muted note">Check your answer to see which options you chose.</p>
      {/if}
    {:else}
      <p class="small muted note">You haven't answered this question yet.</p>
    {/if}
  {/if}
</section>

<style>
  .answers {
    padding: 0;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px 10px 16px;
    cursor: pointer;
    color: var(--text-2);
  }

  .sum {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 8px;
    color: var(--text);
  }

  /* An on/off switch: the real checkbox is invisible on top of it. */
  .switch {
    position: relative;
    flex: none;
    display: inline-flex;
  }

  .switch input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .track {
    position: relative;
    width: 48px;
    height: 28px;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    transition: background 0.15s;
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
    transition: transform 0.15s;
  }

  .switch input:checked + .track {
    background: var(--accent);
    border-color: var(--accent);
  }

  .switch input:checked + .track .thumb {
    transform: translateX(20px);
  }

  .switch input:focus-visible + .track {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0 16px 8px;
    display: flex;
    flex-direction: column;
  }

  .list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 0;
    border-top: 1px solid var(--border);
  }

  .mark {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--danger-soft);
    color: var(--danger);
  }

  .right .mark {
    background: var(--ok-soft);
    color: var(--ok);
  }

  .what {
    flex: 1;
    min-width: 0;
    font-weight: 550;
  }

  .when {
    flex: none;
    text-align: right;
  }

  .note {
    margin: 0;
    padding: 0 16px 12px;
  }
</style>
