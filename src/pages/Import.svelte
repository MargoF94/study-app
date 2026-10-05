<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { diffWords } from '../lib/diff';
  import { decodeText, parseCsv } from '../lib/import/csv';
  import { FIELD_LABELS, buildImport, incomingSets, planImport, type IncomingSet } from '../lib/import/plan';
  import { parseSheet, type ParsedSheet } from '../lib/import/questions';
  import { isXlsx, readXlsx } from '../lib/import/xlsx';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { nowIso, plural } from '../lib/util';

  const presetExam = router.route.query.get('exam') ?? '';

  let fileName = $state('');
  let sheets = $state<ParsedSheet[]>([]);
  let on = $state<boolean[]>([]);
  let readError = $state('');
  let target = $state<string>(presetExam && store.exam(presetExam) ? presetExam : 'new');
  let newName = $state('');
  let removeMissing = $state(false);
  let busy = $state(false);
  let input: HTMLInputElement | undefined = $state();

  const exam = $derived(target === 'new' ? undefined : store.exam(target));
  const usable = $derived(sheets.map((s) => !s.error && s.questions.length > 0));
  const chosen = $derived(sheets.filter((_, i) => on[i] && usable[i]));
  const incoming = $derived<IncomingSet[]>(chosen.flatMap((s) => incomingSets(s.name, s.questions)));
  const plan = $derived(
    planImport(incoming, exam ? store.setsOf(exam.id) : [], exam ? store.questionsOf(exam.id) : []),
  );
  const changes = $derived(plan.counts.new + plan.counts.changed + (removeMissing ? plan.missing.length : 0));
  const skipped = $derived(chosen.flatMap((s) => s.skipped.map((x) => ({ ...x, sheet: s.name }))));
  const emptyRows = $derived(chosen.reduce((n, s) => n + s.emptyRows, 0));
  const firstColumns = $derived(chosen[0]?.columns.filter((c) => c.field || c.option !== undefined) ?? []);

  const FIELD_NAMES: Record<string, string> = {
    id: 'Question number (Q#)',
    question: 'Question',
    options: 'Answer options (split at blank lines)',
    correct: "Correct answer (matched to an option's text, letter or number)",
    explanation: 'Explanation',
    topic: 'Topic',
    reference: 'Reference (links work)',
    set: 'Question set',
  };

  async function pick(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    readError = '';
    sheets = [];
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      fileName = file.name;
      const base = file.name.replace(/\.[^.]+$/, '');
      if (isXlsx(bytes)) sheets = readXlsx(bytes).map((s) => parseSheet(s.name, s.rows));
      else sheets = [parseSheet(base, parseCsv(decodeText(bytes)))];
      on = sheets.map((s) => !s.error && s.questions.length > 0);
      if (!sheets.some((s) => s.questions.length)) readError = sheets.length === 1 && sheets[0].error ? `${sheets[0].error}. The file needs a heading row with at least "Question" and "Answer options" (or Option A, Option B…) columns.` : 'No questions found in this file.';
      const title = sheets.find((s) => s.questions.length)?.title.split('\n')[0] ?? '';
      newName = title.length > 3 && title.length < 120 ? title : base;
    } catch (err) {
      readError = err instanceof Error ? err.message : 'Could not read this file.';
    } finally {
      if (input) input.value = '';
    }
  }

  async function run() {
    if (busy || !chosen.length) return;
    busy = true;
    try {
      const now = nowIso();
      const records = buildImport(plan, { exam, newExamName: newName, examOrder: store.exams.length }, store.sets, removeMissing, now);
      await store.applyImport(records);
      const examId = exam?.id ?? records.exam!.id;
      const parts = [plan.counts.new && `${plural(plan.counts.new, 'new question')}`, plan.counts.changed && `${plan.counts.changed} updated`, removeMissing && plan.missing.length && `${plan.missing.length} removed`].filter(Boolean);
      toasts.show(parts.length ? `Imported: ${parts.join(', ')}.` : 'Nothing changed.');
      router.go(`/exam/${examId}`, true);
    } finally {
      busy = false;
    }
  }

  const changed = $derived(plan.items.filter((i) => i.kind === 'changed'));
  const added = $derived(plan.items.filter((i) => i.kind === 'new'));
  const problems = $derived(plan.items.filter((i) => i.incoming.problem));
  const isUpdate = $derived(!!exam && (plan.counts.changed > 0 || plan.counts.same > 0 || plan.missing.length > 0));
  const label = (setName: string, qid: string) => `${setName}${qid ? ` · Q${qid}` : ''}`;
</script>

<TopBar back={presetExam ? `#/exam/${presetExam}` : '#/'} backLabel="Cancel" title="Import questions" />

<div class="page-body stack">
  <section class="card file">
    <span class="ico"><Icon name="file" size={22} /></span>
    <span class="fi">
      {#if fileName}
        <strong class="fname">{fileName}</strong>
        <span class="small muted">{sheets.length > 1 || /\.xlsx$/i.test(fileName) ? `Excel workbook · ${plural(sheets.length, 'sheet')}` : 'CSV file'}</span>
      {:else}
        <strong>Choose a file</strong>
        <span class="small muted">CSV or Excel (.xlsx). Any sheets with questions can be imported.</span>
      {/if}
    </span>
    <label class="btn {fileName ? '' : 'primary'}">
      {fileName ? 'Change' : 'Choose file'}
      <input bind:this={input} class="visually-hidden" type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onchange={pick} />
    </label>
  </section>

  {#if readError}<p class="error" role="alert">{readError}</p>{/if}

  {#if !fileName}
    <details class="card help">
      <summary>What the file should look like</summary>
      <p class="small">One row per question under a heading row. These headings are recognised (in English or Japanese):</p>
      <ul class="small">
        <li><strong>Q#</strong> (or ID, No.): the question's number. It's how an updated file finds the question it replaces.</li>
        <li><strong>Question</strong></li>
        <li><strong>Answer options</strong>: all options in one cell, separated by blank lines, <em>or</em> one column each: <strong>Option A</strong>, <strong>Option B</strong>…</li>
        <li><strong>Correct answer</strong>: the option's text, letter(s) (B, or A,C) or number(s) (2, or 1,3). If it's missing, "Correct: 2" at the start of the explanation works too.</li>
        <li><strong>Overall explanation</strong>, <strong>Domain</strong> (topic), <strong>Reference</strong>: optional.</li>
      </ul>
      <p class="small m0">A title above the heading row is fine. Rows with a number but no question yet are skipped.</p>
    </details>
  {/if}

  {#if sheets.some((s) => s.questions.length)}
    <section class="card stack">
      <label class="field">
        <span>Add to</span>
        <select bind:value={target}>
          <option value="new">A new exam</option>
          {#each store.exams as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
        </select>
      </label>
      {#if target === 'new'}
        <label class="field"><span>Exam name</span><input bind:value={newName} /></label>
      {/if}
    </section>

    {#if sheets.length > 1}
      <section class="card stack tight">
        <div>
          <h2 class="cap">Sheets</h2>
          <p class="small muted m0">Each sheet becomes a question set in the exam.</p>
        </div>
        {#each sheets as s, i (s.name + i)}
          <button type="button" class="tick" aria-pressed={on[i] && usable[i]} disabled={!usable[i]} onclick={() => (on[i] = !on[i])}>
            <span class="box"><Icon name="check" size={14} /></span>
            <span class="tick-text">
              <span class="tname">{s.name}</span>
              <span class="small muted">
                {#if s.error}{s.error}{:else}{plural(s.questions.length, 'question')}{s.emptyRows ? ` · ${s.emptyRows} empty rows skipped` : ''}{s.skipped.length ? ` · ${s.skipped.length} rows can't be used` : ''}{/if}
              </span>
            </span>
          </button>
        {/each}
      </section>
    {/if}

    {#if firstColumns.length}
      <details class="card">
        <summary>Columns found{chosen[0]?.headerRow ? ` (headings in row ${chosen[0].headerRow + 1})` : ''}</summary>
        <dl class="cols small">
          {#each firstColumns as c, i (i)}
            <dt>{c.header}</dt>
            <dd>{c.field ? FIELD_NAMES[c.field] : `Option ${(c.option ?? 0) + 1}`}</dd>
          {/each}
        </dl>
      </details>
    {/if}

    {#if chosen.length}
      <div class="tiles">
        <div class="tile"><span class="tv">{plan.counts.new}</span><span class="tl">New</span></div>
        <div class="tile"><span class="tv">{plan.counts.changed}</span><span class="tl">Changed</span></div>
        <div class="tile"><span class="tv">{plan.counts.same}</span><span class="tl">Same</span></div>
        <div class="tile"><span class="tv" class:warn={problems.length + skipped.length > 0}>{problems.length + skipped.length}</span><span class="tl">Problems</span></div>
      </div>

      {#if problems.length + skipped.length === 0}
        <p class="okline small"><Icon name="check" size={18} /> Every correct answer matches one of its options.</p>
      {/if}
      {#if emptyRows}
        <p class="infoline small"><Icon name="info" size={18} /> {plural(emptyRows, 'row')} have a number but no question yet. They're skipped, and come in when you fill them and import again.</p>
      {/if}

      {#if problems.length || skipped.length}
        <section class="stack tight">
          <h2 class="cap">Needs a look</h2>
          {#each problems as p (p.setName + p.incoming.row)}
            <div class="card prob small"><Icon name="alert" size={18} /><span><strong>{label(p.setName, p.incoming.qid)} (row {p.incoming.row}):</strong> {p.incoming.problem}. It's imported with a "needs a look" mark so you can fix it in the app.</span></div>
          {/each}
          {#each skipped as s (s.sheet + s.row)}
            <div class="card prob small"><Icon name="alert" size={18} /><span><strong>{s.sheet}, row {s.row}:</strong> {s.message}, so it's skipped.</span></div>
          {/each}
        </section>
      {/if}

      {#if changed.length}
        <section class="stack tight">
          <h2 class="cap">Changed</h2>
          {#each changed.slice(0, 50) as c (c.existing!.id)}
            <details class="card change">
              <summary>
                <span class="small muted">{label(c.setName, c.incoming.qid)} · {c.changes.map((x) => FIELD_LABELS[x.field]).join(', ')}</span>
                <span class="ct">{c.incoming.text}</span>
              </summary>
              {#each c.changes as f (f.field)}
                <p class="cap fl">{FIELD_LABELS[f.field]}</p>
                <p class="diff">{#each diffWords(f.before, f.after) as d, i (i)}{#if d.type === 'del'}<del>{d.text}</del>{:else if d.type === 'ins'}<ins>{d.text}</ins>{:else}{d.text}{/if}{/each}</p>
              {/each}
            </details>
          {/each}
          {#if changed.length > 50}<p class="small muted m0">…and {changed.length - 50} more.</p>{/if}
          <p class="small muted m0">Removed text is struck through; new text is underlined. Changed questions keep your notes, highlights, handwriting and answers.</p>
        </section>
      {/if}

      {#if isUpdate && added.length}
        <section class="stack tight">
          <h2 class="cap">New</h2>
          {#each added.slice(0, 30) as a (a.setName + a.incoming.row)}
            <div class="card newq small"><span class="muted">{label(a.setName, a.incoming.qid)}</span> {a.incoming.text}</div>
          {/each}
          {#if added.length > 30}<p class="small muted m0">…and {added.length - 30} more.</p>{/if}
        </section>
      {/if}

      {#if exam && plan.missing.length}
        <section class="card stack tight">
          <strong>Not in this file: {plural(plan.missing.length, 'question')}</strong>
          <label class="check"><input type="checkbox" bind:checked={removeMissing} /> Remove questions that aren't in the file</label>
          <span class="small muted">Otherwise they're kept.</span>
          {#if removeMissing}
            <span class="small error">Their notes, highlights and handwriting will be deleted too.</span>
          {/if}
        </section>
      {/if}

      <button type="button" class="btn primary go" disabled={busy || changes === 0} onclick={run}>
        {#if changes === 0}Nothing to import{:else if !isUpdate}Import {plural(plan.counts.new, 'question')}{:else}Import {plural(changes, 'change')}{/if}
      </button>
    {/if}
  {/if}
</div>

<style>
  .file {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ico {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: var(--accent-soft);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fi {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .fname {
    overflow-wrap: anywhere;
  }

  .help ul {
    padding-left: 1.2em;
  }

  .tight {
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

  .tick {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 50px;
    padding: 4px 0;
    border: 0;
    background: none;
    text-align: left;
    color: var(--text);
  }

  .tick:disabled {
    cursor: default;
    color: var(--text-2);
  }

  .box {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--text-2);
    color: transparent;
  }

  .tick:disabled .box {
    border-color: var(--border);
    background: var(--surface-2);
  }

  .tick[aria-pressed='true'] .box {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }

  .tick-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .tname {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .cols {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    gap: 6px 12px;
    margin: 10px 0 0;
  }

  .cols dt {
    font-weight: 600;
  }

  .cols dd {
    margin: 0;
    color: var(--text-2);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px;
  }

  .tv {
    font-size: 1.3rem;
    font-weight: 700;
  }

  .tv.warn {
    color: var(--warn);
  }

  .tl {
    font-size: 0.78rem;
    color: var(--text-2);
  }

  .okline,
  .infoline {
    display: flex;
    gap: 8px;
    margin: 0;
    align-items: flex-start;
  }

  .okline {
    color: var(--ok);
  }

  .infoline {
    color: var(--text-2);
  }

  .prob {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
  }

  .prob :global(svg) {
    color: var(--warn);
    margin-top: 2px;
  }

  .change summary {
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: pointer;
  }

  .ct {
    font-weight: 600;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .fl {
    margin: 12px 0 4px;
  }

  .diff {
    margin: 0;
    white-space: pre-wrap;
    font-size: 0.92rem;
    overflow-wrap: anywhere;
  }

  .diff del {
    margin-right: 0.25em;
    background: var(--danger-soft);
    color: var(--danger);
  }

  .diff ins {
    background: var(--ok-soft);
    color: var(--ok);
    text-decoration: none;
    border-bottom: 1.5px solid var(--ok);
  }

  .newq {
    padding: 10px 12px;
  }

  .go {
    min-height: 52px;
    font-size: 1.05rem;
    font-weight: 650;
  }
</style>
