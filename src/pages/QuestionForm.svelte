<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { remapOptionMarks } from '../lib/marks';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import type { Question } from '../lib/types';
  import { newId, nowIso } from '../lib/util';

  // Edit an existing question (id) or add one to an exam (examId).
  let { id, examId: newFor }: { id?: string; examId?: string } = $props();

  // The page is rebuilt for each question, so the props are read once.
  const { original, examId } = untrack(() => {
    const original = id ? store.question(id) : undefined;
    return { original, examId: original?.examId ?? newFor ?? '' };
  });
  const exam = store.exam(examId);
  const sets = store.setsOf(examId);
  const topics = store.topicsOf(examId).filter(Boolean);

  interface Opt {
    key: string;
    /** Position in the saved question, so highlights follow the option. -1 = new. */
    from: number;
    text: string;
    correct: boolean;
  }

  let setId = $state(original?.setId ?? sets[0]?.id ?? '');
  let newSetName = $state(sets.length ? '' : 'My questions');
  let qid = $state(original?.qid ?? '');
  let topic = $state(original?.topic ?? '');
  let text = $state(original?.text ?? '');
  let options = $state<Opt[]>(
    original
      ? original.options.map((t, i) => ({ key: newId(), from: i, text: t, correct: original.correct.includes(i) }))
      : [0, 1, 2, 3].map(() => ({ key: newId(), from: -1, text: '', correct: false })),
  );
  let explanation = $state(original?.explanation ?? '');
  let reference = $state(original?.reference ?? '');
  let error = $state('');

  const correctCount = $derived(options.filter((o) => o.correct && o.text.trim()).length);
  const hint = $derived(
    correctCount === 0
      ? 'Mark at least one correct answer.'
      : correctCount === 1
        ? 'One correct answer. Mark more than one for a "choose 2" question.'
        : `${correctCount} correct answers: shown as "Choose ${correctCount}" when studying.`,
  );

  // A new question gets the next number in its set.
  if (!original) {
    const nums = store
      .questionsOf(examId)
      .filter((q) => q.setId === setId)
      .map((q) => Number(q.qid))
      .filter((n) => Number.isFinite(n));
    qid = String((nums.length ? Math.max(...nums) : 0) + 1);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    options = next;
  }

  function removeOpt(i: number) {
    options = options.filter((_, k) => k !== i);
  }

  function back() {
    if (history.length > 1) history.back();
    else router.go(`/exam/${examId}`);
  }

  async function save(e: Event) {
    e.preventDefault();
    error = '';
    const kept = options.filter((o) => o.text.trim());
    if (!text.trim()) return void (error = 'Write the question.');
    if (kept.length < 2) return void (error = 'Add at least two answer options.');
    if (!kept.some((o) => o.correct)) return void (error = 'Mark the correct answer.');
    const now = nowIso();
    let sid = setId;
    if (!sid) {
      const s = { id: newId(), createdAt: now, updatedAt: now, examId, name: newSetName.trim() || 'My questions', order: sets.length };
      await store.saveSet(s);
      sid = s.id;
    }
    const inSet = store.questionsOf(examId).filter((q) => q.setId === sid);
    const q: Question = {
      ...(original ?? { id: newId(), createdAt: now, updatedAt: now, examId, order: inSet.length ? Math.max(...inSet.map((x) => x.order)) + 1 : 0 }),
      setId: sid,
      qid: qid.trim(),
      topic: topic.trim(),
      text: text.trim(),
      options: kept.map((o) => o.text.trim()),
      correct: kept.flatMap((o, i) => (o.correct ? [i] : [])),
      explanation: explanation.trim(),
      reference: reference.trim(),
      needsReview: undefined,
    };
    await store.saveQuestion(q);
    // Highlights on options follow them when they are reordered or removed.
    if (original) {
      const marks = store.marks.get(original.id);
      const moved = original.options.map((_, old) => kept.findIndex((o) => o.from === old));
      if (marks && moved.some((to, old) => to !== old)) await store.saveMarks(q, remapOptionMarks(marks.ranges, moved));
    }
    toasts.show(original ? 'Question saved.' : 'Question added.');
    back();
  }

  async function remove() {
    if (!original || !confirm('Delete this question? Its notes and handwriting are deleted too.')) return;
    await store.deleteQuestion(original);
    toasts.show('Question deleted.');
    back();
  }
</script>

<TopBar back={original ? undefined : `#/exam/${examId}`} backLabel="Cancel" title={original ? 'Edit question' : 'New question'} sub={exam?.name}>
  {#snippet actions()}
    {#if original}<button type="button" class="btn ghost" onclick={back}>Cancel</button>{/if}
    <button type="submit" form="qform" class="btn primary save">Save</button>
  {/snippet}
</TopBar>

{#if !exam || (id && !original)}
  <div class="page-body"><div class="card empty">This question no longer exists.</div></div>
{:else}
  <form id="qform" class="page-body stack" onsubmit={save}>
    <div class="grid-3">
      <label class="field span2">
        <span>Question set</span>
        {#if sets.length}
          <select bind:value={setId}>
            {#each sets as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
          </select>
        {:else}
          <input bind:value={newSetName} />
        {/if}
      </label>
      <label class="field"><span>Q#</span><input bind:value={qid} /></label>
    </div>

    <label class="field">
      <span>Topic</span>
      <input bind:value={topic} list="topics" />
      <datalist id="topics">{#each topics as t (t)}<option value={t}></option>{/each}</datalist>
    </label>

    <label class="field"><span>Question</span><textarea rows="4" bind:value={text}></textarea></label>

    <section class="stack opts">
      <div>
        <h2 class="lbl">Answer options</h2>
        <p class="small muted m0">{hint}</p>
      </div>
      {#each options as o, i (o.key)}
        <div class="opt" class:correct={o.correct}>
          <div class="ohead">
            <span class="on">Option {i + 1}</span>
            <button type="button" class="pill" class:on={o.correct} aria-pressed={o.correct} onclick={() => (o.correct = !o.correct)}>
              <Icon name="check" size={15} />
              {o.correct ? 'Correct' : 'Mark correct'}
            </button>
            <button type="button" class="btn ghost icon" aria-label="Move option {i + 1} up" disabled={i === 0} onclick={() => move(i, -1)}><Icon name="up" /></button>
            <button type="button" class="btn ghost icon" aria-label="Move option {i + 1} down" disabled={i === options.length - 1} onclick={() => move(i, 1)}><Icon name="down" /></button>
            <button type="button" class="btn ghost icon danger" aria-label="Remove option {i + 1}" onclick={() => removeOpt(i)}><Icon name="trash" /></button>
          </div>
          <textarea rows="2" aria-label="Option {i + 1} text" bind:value={o.text}></textarea>
        </div>
      {/each}
      <button type="button" class="btn add" onclick={() => (options = [...options, { key: newId(), from: -1, text: '', correct: false }])}>
        <Icon name="plus" /> Add option
      </button>
    </section>

    <label class="field"><span>Explanation</span><textarea rows="6" bind:value={explanation}></textarea></label>
    <label class="field"><span>Reference (optional)</span><textarea rows="2" bind:value={reference} placeholder="Source, page or link"></textarea></label>

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <p class="small muted m0">Your notes, highlights, handwriting and answer history stay with the question when you edit it.</p>

    <div class="row">
      <button class="btn primary">Save</button>
      {#if original}<button type="button" class="btn danger" onclick={remove}><Icon name="trash" /> Delete question</button>{/if}
    </div>
  </form>
{/if}

<style>
  .span2 {
    grid-column: span 2;
  }

  .grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .lbl {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-2);
  }

  .opts {
    gap: 10px;
  }

  .opt {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 8px 10px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
  }

  .opt.correct {
    border: 2px solid var(--ok);
    background: var(--ok-soft);
  }

  .ohead {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .on {
    flex: 1;
    font-size: 0.85rem;
    font-weight: 650;
  }

  .pill {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 34px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-2);
    font-size: 0.82rem;
    font-weight: 650;
    margin-right: 2px;
  }

  .pill.on {
    background: var(--ok);
    border-color: var(--ok);
    color: var(--accent-contrast);
  }

  .opt textarea {
    min-height: 3.2em;
    background: var(--paper);
  }

  .add {
    border-style: dashed;
  }

  .save {
    border-radius: 999px;
  }
</style>
