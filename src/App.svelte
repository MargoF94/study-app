<script lang="ts">
  import { onMount } from 'svelte';
  import { router } from './lib/router.svelte';
  import { store } from './lib/store.svelte';
  import { sync } from './lib/sync.svelte';
  import { toasts } from './lib/toast.svelte';
  import { ui } from './lib/ui.svelte';
  import Exam from './pages/Exam.svelte';
  import ExamForm from './pages/ExamForm.svelte';
  import Exams from './pages/Exams.svelte';
  import Import from './pages/Import.svelte';
  import QuestionForm from './pages/QuestionForm.svelte';
  import QuestionList from './pages/QuestionList.svelte';
  import Settings from './pages/Settings.svelte';
  import Study from './pages/Study.svelte';

  let loadError = $state('');

  onMount(async () => {
    try {
      await store.load();
      await sync.init();
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  });

  // Theme: "system" follows the device; otherwise force light/dark.
  $effect(() => {
    const theme = store.settings.theme;
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  });

  const seg = $derived(router.route.segments);

  // Leaving the study screen ends writing, so pages elsewhere scroll normally.
  $effect(() => {
    if (seg[2] !== 'study') ui.writing = false;
  });
</script>

{#if loadError}
  <div class="page-body">
    <div class="card">
      <h1>Couldn't open your data</h1>
      <p>{loadError}</p>
      <p class="muted small">Private browsing modes sometimes block storage. Try a normal window.</p>
    </div>
  </div>
{:else if !store.loaded}
  <p class="page-body muted">Loading…</p>
{:else if seg.length === 0}
  <Exams />
{:else if seg[0] === 'import'}
  {#key router.route.query.toString()}<Import />{/key}
{:else if seg[0] === 'settings'}
  <Settings />
{:else if seg[0] === 'exam' && seg[1] && seg[2] === 'study'}
  {#key seg[1]}<Study examId={seg[1]} />{/key}
{:else if seg[0] === 'exam' && seg[1] && seg[2] === 'edit'}
  {#key seg[1]}<ExamForm examId={seg[1]} />{/key}
{:else if seg[0] === 'exam' && seg[1] && seg[2] === 'questions'}
  {#key seg[1]}<QuestionList examId={seg[1]} />{/key}
{:else if seg[0] === 'exam' && seg[1] && seg[2] === 'new'}
  {#key seg[1]}<QuestionForm examId={seg[1]} />{/key}
{:else if seg[0] === 'exam' && seg[1]}
  {#key seg[1]}<Exam examId={seg[1]} />{/key}
{:else if seg[0] === 'q' && seg[1] && seg[2] === 'edit'}
  {#key seg[1]}<QuestionForm id={seg[1]} />{/key}
{:else}
  <div class="page-body"><div class="card empty"><h1>Not found</h1><a href="#/">Go to your exams</a></div></div>
{/if}

<div class="toasts" aria-live="polite">
  {#each toasts.list as t (t.id)}
    <div class="toast {t.kind}">{t.text}</div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    z-index: 100;
    left: 50%;
    translate: -50% 0;
    bottom: calc(90px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: min(420px, calc(100% - 2rem));
    pointer-events: none;
  }

  .toast {
    background: var(--text);
    color: var(--bg);
    padding: 0.7rem 1rem;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow);
    font-size: 0.9rem;
  }

  .toast.error {
    background: var(--danger);
    color: #fff;
  }
</style>
