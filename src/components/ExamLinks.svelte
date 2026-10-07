<script lang="ts">
  // Every link in an exam: the exam's own, and those on its questions.
  import { openQuestion } from '../lib/navigate';
  import { store } from '../lib/store.svelte';
  import Icon from './Icon.svelte';
  import LinkRow from './LinkRow.svelte';

  let { examId }: { examId: string } = $props();

  let tab = $state<'all' | 'exam' | 'questions'>('all');

  const all = $derived(store.linksOf(examId));
  const examLinks = $derived(all.filter((l) => !l.questionId));
  const questionLinks = $derived(
    all
      .filter((l) => l.questionId && store.question(l.questionId))
      .map((l) => {
        const q = store.question(l.questionId!)!;
        const set = store.setsById.get(q.setId)?.name ?? '';
        return { l, q, tag: `${set.length > 16 ? set.slice(0, 15) + '…' : set}${q.qid ? ` Q${q.qid}` : ''}` };
      }),
  );
</script>

<section class="card links" id="links">
  <div class="head">
    <h2 class="m0">Links</h2>
    <a class="btn small" href="#/link/new?exam={examId}"><Icon name="plus" size={17} /> Add link</a>
  </div>

  {#if all.length === 0}
    <p class="small muted pad m0">No links yet. Add web pages, Google Docs and Sheets or PDFs for the whole exam here, or for one question from its page.</p>
  {:else}
    <div class="pad">
      <div class="segs" role="group" aria-label="Show">
        <button type="button" class:on={tab === 'all'} aria-pressed={tab === 'all'} onclick={() => (tab = 'all')}>All {examLinks.length + questionLinks.length}</button>
        <button type="button" class:on={tab === 'exam'} aria-pressed={tab === 'exam'} onclick={() => (tab = 'exam')}>Exam {examLinks.length}</button>
        <button type="button" class:on={tab === 'questions'} aria-pressed={tab === 'questions'} onclick={() => (tab = 'questions')}>Questions {questionLinks.length}</button>
      </div>
    </div>

    {#if tab !== 'questions'}
      <h3 class="group">For the whole exam</h3>
      {#each examLinks as l (l.id)}
        <LinkRow link={l} />
      {:else}
        <p class="small muted pad m0">None yet.</p>
      {/each}
    {/if}

    {#if tab !== 'exam'}
      <h3 class="group">On questions</h3>
      {#each questionLinks as x (x.l.id)}
        <LinkRow link={x.l} tag={x.tag} tagHref={() => openQuestion(examId, x.q.id)} />
      {:else}
        <p class="small muted pad m0">None yet. Add them from a question's page.</p>
      {/each}
    {/if}
  {/if}
</section>

<style>
  .links {
    padding: 0 0 8px;
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 8px 16px;
  }

  .pad {
    padding: 0 16px 10px;
  }

  .group {
    margin: 0;
    padding: 10px 16px 2px;
    border-top: 1px solid var(--surface-2);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .segs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border-radius: 10px;
    background: var(--surface-2);
  }

  .segs button {
    min-height: 38px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-2);
    font-weight: 600;
    font-size: 0.88rem;
  }

  .segs button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgb(20 26 32 / 0.15);
  }
</style>
