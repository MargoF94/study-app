<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { matchesWhich, type Which } from '../lib/study';
  import type { Question } from '../lib/types';
  import { nowIso, normalize, plural } from '../lib/util';

  let { examId }: { examId: string } = $props();

  const exam = $derived(store.exam(examId));
  const all = $derived(store.questionsOf(examId));
  let search = $state(router.route.query.get('q') ?? '');
  let which = $state<Which | 'review' | 'notes'>('all');
  let limit = $state(100);

  const hasNotes = (q: Question) =>
    !!store.notes.get(q.id)?.text.trim() ||
    !!store.marks.get(q.id)?.ranges.length ||
    !!store.inkFor(q.id, 'page')?.strokes.length ||
    !!store.inkFor(q.id, 'memo')?.strokes.length;

  const list = $derived.by(() => {
    const s = normalize(search);
    return all.filter((q) => {
      if (which === 'review' ? !q.needsReview : which === 'notes' ? !hasNotes(q) : !matchesWhich(store.progress.get(q.id), which)) return false;
      if (!s) return true;
      return normalize([q.qid, q.text, q.topic, ...q.options, q.explanation, store.notes.get(q.id)?.text ?? ''].join(' ')).includes(s);
    });
  });

  $effect(() => {
    void search;
    void which;
    limit = 100;
  });

  async function open(q: Question) {
    const ids = list.map((x) => x.id);
    const now = nowIso();
    const old = store.sessions.get(examId);
    await store.saveSession({ id: examId, createdAt: old?.createdAt ?? now, updatedAt: now, ids, index: ids.indexOf(q.id), label: search ? `Search: ${search}` : 'Browsing' });
    router.go(`/exam/${examId}/study`);
  }

  const status = (q: Question) => {
    const p = store.progress.get(q.id);
    return p?.last === 'right' ? 'right' : p?.last === 'wrong' ? 'wrong' : 'new';
  };
</script>

<TopBar back="#/exam/{examId}" backLabel="Exam" title="Questions" sub={exam?.name} />

<div class="page-body stack">
  <label class="search">
    <Icon name="search" />
    <input type="search" bind:value={search} placeholder="Search questions, options, notes" aria-label="Search" />
  </label>
  <div class="chips">
    {#each [['all', 'All'], ['new', 'New'], ['wrong', 'Wrong'], ['flagged', 'Flagged'], ['notes', 'With notes'], ['review', 'Needs a look']] as [w, label] (w)}
      <button type="button" class="chip" class:accent={which === w} aria-pressed={which === w} onclick={() => (which = w as typeof which)}>{label}</button>
    {/each}
  </div>
  <p class="small muted m0">{plural(list.length, 'question')}{list.length ? ' · tap one to study from there' : ''}</p>

  <ul class="qlist">
    {#each list.slice(0, limit) as q (q.id)}
      {@const st = status(q)}
      <li>
        <button type="button" class="qrow" onclick={() => open(q)}>
          <span class="meta">
            <span class="dot {st}" title={st === 'right' ? 'Last answer right' : st === 'wrong' ? 'Last answer wrong' : 'Not answered'}></span>
            {store.setsById.get(q.setId)?.name ?? ''}{q.qid ? ` · Q${q.qid}` : ''}
            {#if store.progress.get(q.id)?.flagged}<Icon name="flag" size={14} filled />{/if}
            {#if q.needsReview}<span class="warn"><Icon name="alert" size={14} /> needs a look</span>{/if}
          </span>
          <span class="qt">{q.text}</span>
        </button>
        <a class="btn ghost icon" href="#/q/{q.id}/edit" aria-label="Edit question"><Icon name="edit" /></a>
      </li>
    {/each}
  </ul>
  {#if list.length > limit}
    <button type="button" class="btn" onclick={() => (limit += 200)}>Show more</button>
  {/if}
</div>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-2);
  }

  .search input {
    border: 0;
    background: none;
    padding-left: 0;
  }

  .search input:focus {
    outline: none;
  }

  .search:focus-within {
    outline: 2px solid var(--accent);
  }

  .chip {
    border: 0;
    min-height: 34px;
  }

  .qlist {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  li {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 6px;
  }

  li + li {
    border-top: 1px solid var(--surface-2);
  }

  .qrow {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border: 0;
    background: none;
    text-align: left;
    color: var(--text);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--text-2);
  }

  .qt {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.95rem;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.5px solid var(--text-2);
  }

  .dot.right {
    background: var(--ok);
    border-color: var(--ok);
  }

  .dot.wrong {
    background: var(--danger);
    border-color: var(--danger);
  }

  .warn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: var(--warn);
  }
</style>
