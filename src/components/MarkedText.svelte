<script lang="ts">
  // A question's text, an option or the explanation, with your highlights.
  // `data-field` lets a text selection be turned into a highlight.
  import { segments } from '../lib/marks';
  import type { MarkField, MarkRange } from '../lib/types';

  let { text, field, ranges, show = true }: { text: string; field: MarkField; ranges: MarkRange[]; show?: boolean } = $props();

  const parts = $derived(segments(text, show ? ranges : [], field));
</script>

<span class="marked" data-field={field}
  >{#each parts as p, i (i)}{#if p.marked}<mark>{p.text}</mark>{:else}{p.text}{/if}{/each}</span
>

<style>
  .marked {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    -webkit-user-select: text;
    user-select: text;
  }

  mark {
    background: var(--hl);
    color: inherit;
    border-radius: 2px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
</style>
