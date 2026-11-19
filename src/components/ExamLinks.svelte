<script lang="ts">
  // Every link in an exam: the exam's own (in groups you name, and the rest), and those on its
  // questions. Tap a group's name to rename it; while renaming, it can also be moved or deleted.
  import { tick } from 'svelte';
  import { GROUP_NAME_MAX, groupLinks } from '../lib/links';
  import { openQuestion } from '../lib/navigate';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import type { LinkGroup } from '../lib/types';
  import { newId, plural } from '../lib/util';
  import Icon from './Icon.svelte';
  import LinkRow from './LinkRow.svelte';

  let { examId }: { examId: string } = $props();

  let tab = $state<'all' | 'exam' | 'questions'>('all');

  const all = $derived(store.linksOf(examId));
  const groups = $derived(store.linkGroupsOf(examId));
  const parts = $derived(groupLinks(all, groups));
  const examCount = $derived(all.filter((l) => !l.questionId).length);
  const questionLinks = $derived(
    all
      .filter((l) => l.questionId && store.question(l.questionId))
      .map((l) => {
        const q = store.question(l.questionId!)!;
        const set = store.setsById.get(q.setId)?.name ?? '';
        return { l, q, tag: `${set.length > 16 ? set.slice(0, 15) + '…' : set}${q.qid ? ` Q${q.qid}` : ''}` };
      }),
  );

  // Naming: a group being renamed (its id), or a new one.
  const NEW = 'new';
  let editing = $state<string | null>(null);
  let draft = $state('');
  let blurTimer: ReturnType<typeof setTimeout> | undefined;
  /** Moving a group moves its name box on the page, which takes the cursor out of it. */
  let moving = false;

  async function startEdit(g: LinkGroup | null) {
    if (editing) await commit(); // finish the one being named first
    editing = g ? g.id : NEW;
    draft = g ? g.name : '';
    if (tab === 'questions') tab = 'all';
  }

  async function commit() {
    clearTimeout(blurTimer);
    const id = editing;
    const name = draft.trim().slice(0, GROUP_NAME_MAX);
    editing = null;
    if (!id || !name) return; // an empty name keeps the old one (or adds nothing)
    if (id === NEW) {
      const order = groups.length ? Math.max(...groups.map((g) => g.order)) + 1 : 0;
      await store.saveLinkGroups([{ id: newId(), createdAt: '', updatedAt: '', examId, name, order }]);
    } else {
      const g = groups.find((x) => x.id === id);
      if (g && g.name !== name) await store.saveLinkGroups([{ ...g, name }]);
    }
  }

  function cancel() {
    clearTimeout(blurTimer);
    editing = null;
  }

  // Leaving the box saves the name, unless a button beside it was tapped (it acts instead).
  function onblur() {
    if (moving) return;
    blurTimer = setTimeout(() => void commit(), 200);
  }

  function onkey(e: KeyboardEvent) {
    if (e.isComposing || e.keyCode === 229) return; // Return that picks a Japanese conversion
    if (e.key === 'Enter') {
      e.preventDefault();
      void commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }

  /** Buttons beside the name box keep the keyboard up (the box doesn't lose focus). */
  const keepFocus = (e: MouseEvent) => e.preventDefault();

  function focusSelect(el: HTMLInputElement) {
    el.focus();
    el.select();
  }

  async function move(g: LinkGroup, by: -1 | 1) {
    clearTimeout(blurTimer);
    const list = [...groups];
    const i = list.findIndex((x) => x.id === g.id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const name = draft.trim().slice(0, GROUP_NAME_MAX) || g.name;
    moving = true;
    try {
      // Numbered again from 0: two devices may have given groups the same place.
      await store.saveLinkGroups(list.map((x, k) => ({ ...x, order: k, ...(x.id === g.id ? { name } : {}) })));
      await tick();
    } finally {
      moving = false;
    }
    document.querySelector<HTMLInputElement>('#links .gedit input')?.focus(); // keep naming it
  }

  async function removeGroup(g: LinkGroup) {
    const n = parts.grouped.find((x) => x.group.id === g.id)?.links.length ?? 0;
    const ok = confirm(n ? `Delete the group “${g.name}”? Its ${plural(n, 'link')} will stay, outside any group.` : `Delete the group “${g.name}”?`);
    clearTimeout(blurTimer);
    if (!ok) return;
    editing = null;
    await store.deleteLinkGroup(g);
    toasts.show('Group deleted.');
  }
</script>

{#snippet nameBox(g: LinkGroup | null, i: number)}
  <div class="gedit">
    <div class="erow">
      <input
        bind:value={draft}
        use:focusSelect
        maxlength={GROUP_NAME_MAX}
        enterkeyhint="done"
        placeholder="Group name, e.g. Official docs"
        aria-label={g ? `New name for the group ${g.name}` : 'Name of the new group'}
        onkeydown={onkey}
        {onblur}
      />
      <span class="ebtns">
        <button type="button" class="btn primary small" onmousedown={keepFocus} onclick={commit}>{g ? 'Done' : 'Add group'}</button>
        <button type="button" class="btn ghost small" onmousedown={keepFocus} onclick={cancel}>Cancel</button>
      </span>
    </div>
    {#if g}
      <div class="erow more">
        <button type="button" class="btn ghost small" disabled={i === 0} onmousedown={keepFocus} onclick={() => move(g, -1)}><Icon name="up" size={16} /> Move up</button>
        <button type="button" class="btn ghost small" disabled={i === groups.length - 1} onmousedown={keepFocus} onclick={() => move(g, 1)}><Icon name="down" size={16} /> Move down</button>
        <button type="button" class="btn ghost small danger" onmousedown={keepFocus} onclick={() => removeGroup(g)}><Icon name="trash" size={16} /> Delete group</button>
      </div>
    {/if}
  </div>
{/snippet}

<section class="card links" id="links">
  <div class="head">
    <h2 class="m0">Links</h2>
    <span class="hacts">
      <button type="button" class="btn small" disabled={editing === NEW} onclick={() => startEdit(null)}><Icon name="folderPlus" size={17} /> New group</button>
      <a class="btn small" href="#/link/new?exam={examId}"><Icon name="plus" size={17} /> Add link</a>
    </span>
  </div>

  {#if all.length === 0 && groups.length === 0 && editing !== NEW}
    <p class="small muted pad m0">No links yet. Add web pages, Google Docs and Sheets or PDFs for the whole exam here, or for one question from its page. Sort the exam's links into groups with New group.</p>
  {:else}
    <div class="pad">
      <div class="segs" role="group" aria-label="Show">
        <button type="button" class:on={tab === 'all'} aria-pressed={tab === 'all'} onclick={() => (tab = 'all')}>All {examCount + questionLinks.length}</button>
        <button type="button" class:on={tab === 'exam'} aria-pressed={tab === 'exam'} onclick={() => (tab = 'exam')}>Exam {examCount}</button>
        <button type="button" class:on={tab === 'questions'} aria-pressed={tab === 'questions'} onclick={() => (tab = 'questions')}>Questions {questionLinks.length}</button>
      </div>
    </div>

    {#if tab !== 'questions'}
      <h3 class="section">For the whole exam</h3>
      {#each parts.grouped as { group: g, links: members }, i (g.id)}
        <div class="lgroup">
          {#if editing === g.id}
            {@render nameBox(g, i)}
          {:else}
            <div class="ghead">
              <button type="button" class="gname" title="Rename this group" onclick={() => startEdit(g)}>
                <Icon name="folder" size={19} />
                <span class="gtitle">{g.name}</span>
                <span class="gcount" aria-label={plural(members.length, 'link')}>{members.length}</span>
              </button>
              <button type="button" class="btn ghost icon" aria-label="Rename the group {g.name}" title="Rename" onclick={() => startEdit(g)}><Icon name="edit" size={18} /></button>
              <a class="btn ghost icon" href="#/link/new?exam={examId}&group={g.id}" aria-label="Add a link to {g.name}" title="Add a link to this group"><Icon name="plus" size={19} /></a>
            </div>
          {/if}
          <div class="members">
            {#each members as l (l.id)}
              <LinkRow link={l} />
            {:else}
              <p class="small muted pad m0">No links in this group yet. Tap + to add one, or choose this group when you edit a link.</p>
            {/each}
          </div>
        </div>
      {/each}

      {#if editing === NEW}
        <div class="lgroup">{@render nameBox(null, -1)}</div>
      {/if}

      {#if parts.grouped.length && parts.ungrouped.length}
        <h4 class="sub">Not in a group</h4>
      {/if}
      {#each parts.ungrouped as l (l.id)}
        <LinkRow link={l} />
      {:else}
        {#if !parts.grouped.length && editing !== NEW}
          <p class="small muted pad m0">None yet.</p>
        {/if}
      {/each}
    {/if}

    {#if tab !== 'exam'}
      <h3 class="section">On questions</h3>
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
    gap: 8px;
    padding: 12px 12px 8px 16px;
  }

  .hacts {
    display: flex;
    gap: 6px;
  }

  .pad {
    padding: 0 16px 10px;
  }

  .section {
    margin: 0;
    padding: 10px 16px 2px;
    border-top: 1px solid var(--surface-2);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .lgroup {
    padding-bottom: 4px;
  }

  .lgroup + .lgroup {
    border-top: 1px solid var(--surface-2);
  }

  .ghead {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px 0 8px;
  }

  .gname {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 4px 8px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font-size: 1rem;
    font-weight: 650;
    text-align: left;
  }

  .gname:hover {
    background: var(--surface-2);
  }

  .gname > :global(svg) {
    color: var(--accent);
  }

  .gtitle {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .gcount {
    flex: none;
    min-width: 22px;
    height: 22px;
    padding: 0 7px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 0.75rem;
    font-weight: 650;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* A group's links sit under its name. */
  .members {
    margin-left: 25px;
    border-left: 2px solid var(--accent-soft);
  }

  .members :global(.row-link .open) {
    padding-left: 12px;
  }

  .members .pad {
    padding: 4px 12px 8px;
  }

  .gedit {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px 8px 16px;
  }

  .erow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .erow input {
    flex: 1 1 200px;
    font-weight: 600;
  }

  .ebtns {
    display: flex;
    gap: 6px;
  }

  .more .btn:not(.danger) {
    color: var(--text-2);
  }

  .sub {
    margin: 0;
    padding: 10px 16px 2px;
    border-top: 1px solid var(--surface-2);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-2);
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
