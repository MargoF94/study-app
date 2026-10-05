<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import type { QuestionSet } from '../lib/types';
  import { plural } from '../lib/util';

  let { examId }: { examId: string } = $props();

  const exam = $derived(store.exam(examId));
  const sets = $derived(store.setsOf(examId));
  let name = $state(untrack(() => store.exam(examId)?.name ?? ''));

  async function saveName(e: Event) {
    e.preventDefault();
    if (!exam || !name.trim()) return;
    await store.saveExam({ ...exam, name: name.trim() });
    toasts.show('Saved.');
  }

  async function renameSet(s: QuestionSet, value: string) {
    const v = value.trim();
    if (v && v !== s.name) await store.saveSet({ ...s, name: v });
  }

  async function moveSet(s: QuestionSet, dir: -1 | 1) {
    const i = sets.indexOf(s);
    const other = sets[i + dir];
    if (!other) return;
    await store.put('sets', sets.map((x, j) => ({ ...x, order: j === i ? i + dir : j === i + dir ? i : j })));
  }

  async function deleteSet(s: QuestionSet) {
    const n = store.questionsOf(examId).filter((q) => q.setId === s.id).length;
    if (!confirm(`Delete the set "${s.name}" and its ${plural(n, 'question')}? Notes and handwriting on them are deleted too.`)) return;
    await store.deleteSet(s);
  }

  async function resetProgress() {
    if (!confirm('Clear your answers for this exam? Flags, notes and handwriting stay.')) return;
    const list = [...store.progress.values()].filter((p) => p.examId === examId);
    await store.put('progress', list.map((p) => ({ ...p, attempts: 0, right: 0, last: undefined, lastAt: undefined })));
    toasts.show('Answers cleared.');
  }

  async function deleteExam() {
    if (!exam) return;
    if (!confirm(`Delete "${exam.name}" with all its questions, notes, handwriting and answers? This can't be undone.`)) return;
    await store.deleteExam(exam);
    router.go('/');
  }
</script>

<TopBar back="#/exam/{examId}" backLabel="Exam" title="Edit exam" />

{#if exam}
  <div class="page-body stack">
    <form class="card stack" onsubmit={saveName}>
      <label class="field"><span>Exam name</span><input bind:value={name} /></label>
      <div><button class="btn primary" disabled={!name.trim() || name.trim() === exam.name}>Save name</button></div>
    </form>

    <section class="card stack">
      <h2 class="m0">Question sets</h2>
      {#each sets as s, i (s.id)}
        <div class="setrow">
          <input aria-label="Set name" value={s.name} onchange={(e) => renameSet(s, e.currentTarget.value)} />
          <button type="button" class="btn ghost icon" aria-label="Move up" disabled={i === 0} onclick={() => moveSet(s, -1)}><Icon name="up" /></button>
          <button type="button" class="btn ghost icon" aria-label="Move down" disabled={i === sets.length - 1} onclick={() => moveSet(s, 1)}><Icon name="down" /></button>
          <button type="button" class="btn ghost danger small" onclick={() => deleteSet(s)}>Delete</button>
        </div>
      {:else}
        <p class="muted m0">No sets yet. Sets are created when you import a file or add a question.</p>
      {/each}
    </section>

    <section class="card stack">
      <h2 class="m0">Your answers</h2>
      <p class="m0 small muted">Start over: clears which questions you answered and whether you got them right.</p>
      <div><button type="button" class="btn" onclick={resetProgress}>Clear answers</button></div>
    </section>

    <section class="card stack">
      <h2 class="m0">Delete exam</h2>
      <div><button type="button" class="btn danger" onclick={deleteExam}>Delete this exam</button></div>
    </section>
  </div>
{/if}

<style>
  .setrow {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .setrow input {
    flex: 1;
  }
</style>
