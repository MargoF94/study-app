<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import SyncBadge from '../components/SyncBadge.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { examStats } from '../lib/study';
  import { newId, nowIso, plural } from '../lib/util';

  let adding = $state(false);
  let name = $state('');

  async function create(e: Event) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const now = nowIso();
    const id = newId();
    await store.saveExam({ id, createdAt: now, updatedAt: now, name: n, order: store.exams.length });
    name = '';
    adding = false;
    router.go(`/exam/${id}`);
  }
</script>

<header class="home-bar">
  <div class="inner">
    <span class="brand"><Icon name="book" size={22} /> Study Log</span>
    <SyncBadge />
    <a class="btn ghost icon" href="#/settings" aria-label="Settings" title="Settings"><Icon name="settings" size={22} /></a>
  </div>
</header>

<div class="page-body stack">
  <div class="row between">
    <h1 class="m0">Your exams</h1>
    {#if store.exams.length}<span class="small muted">{plural(store.exams.length, 'exam')}</span>{/if}
  </div>

  {#each store.exams as exam (exam.id)}
    {@const qs = store.questionsOf(exam.id)}
    {@const st = examStats(qs, store.progress)}
    {@const sets = store.setsOf(exam.id)}
    {@const session = store.sessions.get(exam.id)}
    <section class="card exam">
      <a class="main" href="#/exam/{exam.id}">
        <span class="ico"><Icon name="book" size={22} /></span>
        <span class="info">
          <span class="name">{exam.name}</span>
          <span class="small muted">{plural(qs.length, 'question')}{sets.length > 1 ? ` · ${sets.length} sets` : ''} · {plural(store.topicsOf(exam.id).filter(Boolean).length, 'topic')}</span>
          <span class="bar" aria-hidden="true"><span style:width="{qs.length ? Math.round((st.answered / qs.length) * 100) : 0}%"></span></span>
          <span class="small muted">{st.answered} answered ({qs.length ? Math.round((st.answered / qs.length) * 100) : 0}%) · {st.right} correct</span>
        </span>
        <Icon name="next" />
      </a>
      {#if session && session.ids.length}
        <a class="cont" href="#/exam/{exam.id}/study">
          <span>Continue: question {Math.min(session.index + 1, session.ids.length)} of {session.ids.length}</span>
          <Icon name="arrow" size={18} />
        </a>
      {/if}
    </section>
  {:else}
    <div class="card empty stack">
      <p class="m0"><strong>No exams yet.</strong></p>
      <p class="m0 small">Import a CSV or Excel file of questions to start, or create an exam and add questions by hand.</p>
    </div>
  {/each}

  {#if adding}
    <form class="card stack" onsubmit={create}>
      <label class="field"><span>Exam name</span><input bind:value={name} placeholder="e.g. Salesforce Certified Marketing Cloud Next Consultant" /></label>
      <div class="row">
        <button class="btn primary" disabled={!name.trim()}>Create exam</button>
        <button type="button" class="btn" onclick={() => (adding = false)}>Cancel</button>
      </div>
    </form>
  {:else}
    <div class="two">
      <button type="button" class="btn big" onclick={() => (adding = true)}><Icon name="plus" /> New exam</button>
      <a class="btn primary big" href="#/import"><Icon name="upload" /> Import file</a>
    </div>
    <p class="small muted m0">Import a CSV or Excel file to start a new exam, or to add and update questions in one you already have.</p>
  {/if}
</div>

<style>
  .home-bar {
    position: sticky;
    top: 0;
    z-index: 30;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding-top: env(safe-area-inset-top);
  }

  .home-bar .inner {
    max-width: var(--page-max);
    margin: 0 auto;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px 0 16px;
  }

  .brand {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--accent);
  }

  .between {
    justify-content: space-between;
  }

  .exam {
    padding: 0;
    overflow: hidden;
  }

  .main {
    display: flex;
    gap: 14px;
    padding: 16px;
    color: var(--text);
    text-decoration: none;
    align-items: center;
  }

  .ico {
    flex: none;
    align-self: flex-start;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: var(--accent-soft);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .name {
    font-weight: 650;
    font-size: 1.05rem;
    line-height: 1.3;
  }

  .bar {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
    margin-top: 4px;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }

  .cont {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    padding: 0 16px;
    border-top: 1px solid var(--border);
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
    font-size: 0.92rem;
  }

  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .big {
    min-height: 48px;
  }
</style>
