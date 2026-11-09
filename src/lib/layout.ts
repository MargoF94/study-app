// Where the question page sits on screen. The page is laid out at a fixed width in
// page units and scaled to fit, so its line breaks — and any handwriting on it — are
// the same in every mode, orientation and device.
import { PAGE_WIDTH, WIDE_PAGE_WIDTH } from './types';

/** A narrow page grows to at most this scale (it would get very large otherwise). */
export const NARROW_MAX_SCALE = 1.4;

/** Reading columns at least this wide (iPads, computers) get the wide page. */
export const WIDE_FROM = 560;

/** The page width for a reading column of this width. */
export function layoutFor(column: number): number {
  return column >= WIDE_FROM ? WIDE_PAGE_WIDTH : PAGE_WIDTH;
}

export interface PageGeometry {
  scale: number;
  /** On-screen width of the page. */
  width: number;
  /** Space from the left edge of the frame to the page. */
  offset: number;
  /** Space beside the page, in page units (writable in Notes mode). */
  margin: number;
}

/**
 * `frame` is the space for the page and the margins beside it; `column` is the reading
 * column, the width Clean mode uses. A wide page fills the column exactly, so it is the
 * same size in every mode; a narrow page keeps its old size limit.
 */
export function pageGeometry(layout: number, frame: number, column: number): PageGeometry {
  const scale = layout <= PAGE_WIDTH ? Math.min(frame / layout, NARROW_MAX_SCALE) : Math.min(frame, column || frame) / layout;
  const width = layout * scale;
  const offset = Math.max(0, (frame - width) / 2);
  return { scale, width, offset, margin: offset / scale };
}
