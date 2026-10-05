<script lang="ts">
  // Plain text with web addresses turned into links.
  let { text }: { text: string } = $props();

  const parts = $derived(text.split(/(https?:\/\/[^\s<>"]+)/g));
</script>

<span class="linkified"
  >{#each parts as p, i (i)}{#if i % 2 === 1}<a href={p} target="_blank" rel="noopener noreferrer">{p}</a>{:else}{p}{/if}{/each}</span
>

<style>
  .linkified {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
