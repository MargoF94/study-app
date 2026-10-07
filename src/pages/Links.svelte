<script lang="ts">
  import ExamLinks from '../components/ExamLinks.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { store } from '../lib/store.svelte';

  let { examId }: { examId: string } = $props();

  const exam = $derived(store.exam(examId));
</script>

<TopBar back="#/exam/{examId}" backLabel="Exam" title="Links" sub={exam?.name} />

<div class="page-body stack">
  {#if exam}
    <ExamLinks {examId} />
    <p class="small muted m0">Tap a link to open it in a new tab, or a question's tag to go to that question.</p>
  {:else}
    <div class="card empty">This exam was deleted.</div>
  {/if}
</div>
