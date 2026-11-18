// A text box that grows and shrinks to fit its text, so all of it shows without scrolling
// inside the box. Use as `use:autosize={deps}`: pass whatever changes the text from outside or
// its size (the question shown, font, text size) so it fits again. It also refits when the box
// gets wider or narrower (the text rewraps) and once web fonts have loaded.
import type { ActionReturn } from 'svelte/action';

export function autosize(el: HTMLTextAreaElement, _deps?: unknown): ActionReturn<unknown> {
  el.style.overflowY = 'hidden';
  el.style.resize = 'none';
  let length = el.value.length;

  /** `measure`: let it shrink first. Not needed while typing adds text, so typing stays smooth. */
  const fit = (measure = true) => {
    if (!el.isConnected) return;
    const shorter = el.value.length < length;
    length = el.value.length;
    const cs = getComputedStyle(el);
    const borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    // Shrinking the box for a moment can make the page jump: keep its place.
    const x = window.scrollX;
    const y = window.scrollY;
    if (measure || shorter) el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + borders}px`;
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
  };
  const onInput = () => fit(false);
  const later = () => requestAnimationFrame(() => fit());

  let width = -1;
  const resized = new ResizeObserver(() => {
    if (el.clientWidth === width) return; // its own height changes don't matter
    width = el.clientWidth;
    fit();
  });
  resized.observe(el);
  el.addEventListener('input', onInput);
  document.fonts?.addEventListener('loadingdone', later);
  fit();

  return {
    update: later,
    destroy() {
      resized.disconnect();
      el.removeEventListener('input', onInput);
      document.fonts?.removeEventListener('loadingdone', later);
    },
  };
}
