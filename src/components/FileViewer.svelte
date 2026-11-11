<script lang="ts">
  // A question's files, full screen. Pictures fit the screen: tap to zoom in where you tapped
  // (then drag or scroll around), tap again to fit. Other files can be opened (PDF, text) or
  // shared/saved. Swipe, the arrow buttons or the arrow keys go to the next file.
  import { tick, untrack } from 'svelte';
  import { attachments } from '../lib/attachments.svelte';
  import { badgeOf, canOpen, formatBytes, isImage, kindOf } from '../lib/files';
  import { toasts } from '../lib/toast.svelte';
  import type { Attachment } from '../lib/types';
  import Icon from './Icon.svelte';

  let { list, start, onclose }: { list: Attachment[]; start: string; onclose: () => void } = $props();

  let current = $state(untrack(() => start));
  const index = $derived(list.findIndex((a) => a.id === current));
  const file = $derived(index >= 0 ? list[index] : undefined);
  const url = $derived(file ? attachments.urls[file.id] : undefined);

  let dialog = $state<HTMLDialogElement>();
  let stage = $state<HTMLElement>();
  let img = $state<HTMLImageElement>();
  let zoomed = $state(false);
  let zoomWidth = $state(0);
  /** Pictures this browser can't show (an iPhone photo on Windows, say) are offered as files. */
  let failed = $state<Record<string, boolean>>({});
  const picture = $derived(!!file && isImage(file.type) && !failed[file.id]);

  // Phones and iPad share (Save to Files, Save Image, AirDrop…); computers download.
  const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
  /** The current file, ready beforehand: Safari only shares straight from a tap. */
  let shareable = $state<File | null>(null);

  $effect(() => {
    if (!dialog) return;
    dialog.showModal();
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = before;
    };
  });

  $effect(() => {
    const f = file;
    void url; // again once it has downloaded
    shareable = null;
    if (!f) return;
    void attachments.load(f);
    let alive = true;
    void attachments.file(f).then((x) => {
      if (alive) shareable = x;
    });
    return () => {
      alive = false;
    };
  });

  // Deleted meanwhile (on another device or tab).
  $effect(() => {
    if (!file) dialog?.close();
  });

  function step(d: number) {
    if (list.length < 2) return;
    current = list[(Math.max(index, 0) + d + list.length) % list.length].id;
    zoomed = false;
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  }

  function save() {
    const f = shareable;
    if (!f) {
      toasts.show('This file is not on this device yet.', 'error');
      return;
    }
    if (touch && navigator.canShare?.({ files: [f] })) {
      navigator.share({ files: [f], title: f.name }).catch((e: unknown) => {
        if ((e as Error)?.name !== 'AbortError') download(f);
      });
      return;
    }
    download(f);
  }

  function download(f: File) {
    const href = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = href;
    a.download = f.name;
    // Inside the dialog: everything behind it can't be clicked while it's open.
    dialog?.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }

  async function remove() {
    const f = file;
    if (!f || !confirm(`Delete “${f.name}” from this question?`)) return;
    // Move on first: a file that disappears from under the viewer closes it.
    const next = list[index + 1] ?? list[index - 1];
    zoomed = false;
    if (next) current = next.id;
    await attachments.remove(f);
    if (!next) dialog?.close();
  }

  // Taps zoom; swipes go to the next or previous file; a mouse drags a zoomed picture around.
  let from: { x: number; y: number } | null = null;
  let moved = false;

  function down(e: PointerEvent) {
    from = { x: e.clientX, y: e.clientY };
    moved = false;
  }

  function move(e: PointerEvent) {
    if (!from) return;
    if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 8) moved = true;
    if (zoomed && e.pointerType === 'mouse' && stage) {
      stage.scrollLeft -= e.movementX;
      stage.scrollTop -= e.movementY;
    }
  }

  function up(e: PointerEvent) {
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    from = null;
    if (!zoomed && e.pointerType !== 'mouse' && Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
  }

  async function tap(e: MouseEvent) {
    if (moved || !img || !stage) return;
    if (zoomed) {
      zoomed = false;
      return;
    }
    const r = img.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    zoomWidth = Math.round(r.width * 2.5);
    zoomed = true;
    await tick();
    // Keep the tapped spot under the finger.
    const s = stage.getBoundingClientRect();
    stage.scrollLeft = img.offsetLeft + fx * img.offsetWidth - (e.clientX - s.left);
    stage.scrollTop = img.offsetTop + fy * img.offsetHeight - (e.clientY - s.top);
  }
</script>

<dialog bind:this={dialog} class="viewer" data-floating aria-label={file?.name ?? 'File'} onclose={onclose} {onkeydown}>
  {#if file}
    <div class="frame">
      <div class="bar">
        <div class="title">
          <span class="name">{file.name}</span>
          <span class="sub">{list.length > 1 ? `${index + 1} of ${list.length} · ` : ''}{formatBytes(file.size)}</span>
        </div>
        <button type="button" class="tb" onclick={save} disabled={!shareable} aria-label={touch ? 'Share or save' : 'Download'} title={touch ? 'Share or save' : 'Download'}>
          <Icon name={touch ? 'share' : 'download'} size={22} />
        </button>
        <button type="button" class="tb" onclick={remove} aria-label="Delete file" title="Delete file"><Icon name="trash" size={22} /></button>
        <button type="button" class="tb" onclick={() => dialog?.close()} aria-label="Close" title="Close"><Icon name="close" size={24} /></button>
      </div>

      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="stage" class:zoomed bind:this={stage} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={() => (from = null)} onclick={tap}>
        {#if picture && url}
          <img
            bind:this={img}
            src={url}
            alt={file.name}
            draggable="false"
            style:width={zoomed ? `${zoomWidth}px` : null}
            onerror={() => (failed = { ...failed, [file.id]: true })}
          />
        {:else}
          <div class="doc">
            <span class="badge k-{kindOf(file.name, file.type)}" aria-hidden="true">{badgeOf(file.name, file.type)}</span>
            <p class="dname">{file.name}</p>
            {#if !url}
              <p class="dnote">{attachments.missing[file.id] ? 'This file is not on this device yet. It downloads after the next sync, when you are online.' : 'Loading…'}</p>
            {:else if picture === false && isImage(file.type)}
              <p class="dnote">This browser can't show this picture. Save it to open it in another app.</p>
            {/if}
            <div class="row center">
              {#if url && canOpen(file) && !isImage(file.type)}
                <a class="btn primary" href={url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} /> Open</a>
              {/if}
              <button type="button" class="btn" onclick={save} disabled={!shareable}>
                <Icon name={touch ? 'share' : 'download'} size={18} />
                {touch ? 'Share or save' : 'Download'}
              </button>
            </div>
          </div>
        {/if}
      </div>

      {#if list.length > 1}
        <button type="button" class="nav prev" onclick={() => step(-1)} aria-label="Previous file"><Icon name="back" size={26} /></button>
        <button type="button" class="nav next" onclick={() => step(1)} aria-label="Next file"><Icon name="next" size={26} /></button>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .viewer {
    width: 100vw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: #0e1012;
    color: #f1f2f3;
    overscroll-behavior: contain;
  }

  .viewer::backdrop {
    background: rgb(0 0 0 / 0.5);
  }

  .frame {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: calc(8px + env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 8px max(16px, env(safe-area-inset-left));
    background: rgb(0 0 0 / 0.35);
  }

  .title {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    font-size: 0.8rem;
    color: #b9c0c6;
  }

  .tb {
    flex: none;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
  }

  .tb:hover {
    background: rgb(255 255 255 / 0.12);
  }

  .tb:disabled {
    opacity: 0.4;
  }

  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
    touch-action: pinch-zoom;
    user-select: none;
    -webkit-user-select: none;
  }

  .stage.zoomed {
    overflow: auto;
    touch-action: auto;
    overscroll-behavior: contain;
  }

  /* margin: auto centres the picture and still lets a zoomed one scroll to every edge. */
  .stage img {
    flex: none;
    margin: auto;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    cursor: zoom-in;
  }

  .stage.zoomed img {
    max-width: none;
    max-height: none;
    cursor: zoom-out;
  }

  .doc {
    margin: auto;
    padding: 24px;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    user-select: text;
    -webkit-user-select: text;
  }

  .dname {
    margin: 4px 0 0;
    font-weight: 600;
    font-size: 1.1rem;
    overflow-wrap: anywhere;
  }

  .dnote {
    margin: 0;
    color: #b9c0c6;
  }

  .center {
    justify-content: center;
    margin-top: 8px;
  }

  .badge {
    width: 72px;
    height: 72px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #fff;
    background: #4a5a6a;
  }

  .k-pdf {
    background: #a8323a;
  }
  .k-doc {
    background: #2f5fa8;
  }
  .k-sheet {
    background: #1e7a43;
  }
  .k-slides {
    background: #9a6a12;
  }
  .k-image {
    background: #7a3a8a;
  }

  .nav {
    position: absolute;
    top: 55%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.5);
    color: #fff;
  }

  .nav:hover {
    background: rgb(0 0 0 / 0.7);
  }

  .prev {
    left: max(10px, env(safe-area-inset-left));
  }

  .next {
    right: max(10px, env(safe-area-inset-right));
  }
</style>
