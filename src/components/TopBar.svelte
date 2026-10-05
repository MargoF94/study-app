<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  // The bar at the top of each screen: a way back, a title, and actions.
  let {
    back,
    backLabel = 'Back',
    title,
    sub,
    actions,
  }: { back?: string; backLabel?: string; title?: string; sub?: string; actions?: Snippet } = $props();
</script>

<header class="topbar">
  <div class="inner">
    {#if back}
      <a class="backlink" href={back}><Icon name="back" size={22} /><span class="bl">{backLabel}</span></a>
    {/if}
    <div class="titles">
      {#if title}<span class="title">{title}</span>{/if}
      {#if sub}<span class="sub">{sub}</span>{/if}
    </div>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </div>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding-top: env(safe-area-inset-top);
  }

  .inner {
    max-width: var(--page-max);
    margin: 0 auto;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
  }

  .backlink {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 44px;
    padding-right: 8px;
    border-radius: 8px;
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
    flex: none;
  }

  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    padding-left: 8px;
  }

  .backlink + .titles {
    padding-left: 0;
  }

  .title {
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    font-size: 0.8rem;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }

  @media (max-width: 420px) {
    .bl {
      display: none;
    }
  }
</style>
