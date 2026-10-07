<script lang="ts">
  // One link: a badge for its kind, the title and website, and an edit button.
  // Opens in a new tab. Addresses that aren't web addresses are shown but not opened.
  import { isWebUrl, linkInfo, linkTitle } from '../lib/links';
  import type { Link } from '../lib/types';
  import Icon from './Icon.svelte';

  let { link, tag, tagHref }: { link: Link; tag?: string; tagHref?: () => void } = $props();

  const info = $derived(linkInfo(link.url));
  const title = $derived(linkTitle(link));
  const ok = $derived(isWebUrl(link.url));
</script>

<div class="row-link">
  <a class="open" href={ok ? link.url : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!ok}>
    <span class="badge k-{info.kind}" aria-hidden="true">{info.mark}</span>
    <span class="text">
      <span class="title">{title}</span>
      <span class="meta">{info.label}{info.host ? ` · ${info.host}` : ''}{ok ? '' : ' · not a web address'}</span>
    </span>
    {#if ok}<span class="ext"><Icon name="external" size={17} /></span>{/if}
  </a>
  {#if tag && tagHref}
    <button type="button" class="tag" onclick={tagHref}>{tag}</button>
  {/if}
  <a class="btn ghost icon" href="#/link/{link.id}/edit" aria-label="Edit link {title}" title="Edit link"><Icon name="edit" size={19} /></a>
</div>

<style>
  .row-link {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 8px;
  }

  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 6px 10px 16px;
    color: var(--text);
    text-decoration: none;
  }

  .open:hover .title {
    text-decoration: underline;
  }

  .badge {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #fff;
    background: #3d5467;
  }

  .k-sheet {
    background: #1e7a43;
  }
  .k-doc {
    background: #2f5fa8;
  }
  .k-slides {
    background: #9a6a12;
  }
  .k-pdf {
    background: #a8323a;
  }
  .k-drive {
    background: #4a5a6a;
  }
  .k-video {
    background: #7a3a8a;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .title {
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: 0.8rem;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ext {
    color: var(--text-2);
    flex: none;
  }

  .tag {
    flex: none;
    min-height: 32px;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 650;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
