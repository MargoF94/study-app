// Handwriting geometry: turning recorded points into smooth pen shapes, and
// finding which stroke the eraser touches. Points are in page units.
import { getStroke } from 'perfect-freehand';
import type { InkColor, InkTool, Stroke } from './types';

export const PEN_COLORS: InkColor[] = ['ink', 'blue', 'red', 'green'];
export const MARKER_COLORS: InkColor[] = ['yellow', 'green', 'pink', 'blue'];
export const COLOR_NAMES: Record<InkColor, string> = { ink: 'Black', blue: 'Blue', red: 'Red', green: 'Green', yellow: 'Yellow', pink: 'Pink' };

export const PEN_SIZE = 2.2;
export const MARKER_SIZE = 14;

/** Pairs of [x, y, pressure] from a stroke's flat point list. */
export function points(s: Stroke): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i + 2 < s.pts.length; i += 3) out.push([s.pts[i], s.pts[i + 1], s.pts[i + 2]]);
  return out;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Adds a point, rounded so stored handwriting stays small. */
export function addPoint(s: Stroke, x: number, y: number, pressure: number): void {
  const n = s.pts.length;
  const px = round(x, 1);
  const py = round(y, 1);
  if (n >= 3 && s.pts[n - 3] === px && s.pts[n - 2] === py) return;
  s.pts.push(px, py, round(pressure || 0.5, 2));
}

/** The filled outline of a stroke as an SVG path. */
export function strokePath(s: Stroke, live = false): string {
  const pts = points(s);
  if (pts.length === 0) return '';
  const marker = s.tool === 'marker';
  const outline = getStroke(pts, {
    size: s.size,
    thinning: marker ? 0 : 0.55,
    smoothing: 0.5,
    streamline: marker ? 0.6 : 0.45,
    simulatePressure: !marker && pts.every((p) => p[2] === 0.5),
    last: !live,
    start: { cap: true },
    end: { cap: true },
  });
  if (outline.length < 2) return '';
  let d = `M${outline[0][0].toFixed(1)},${outline[0][1].toFixed(1)}`;
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += ` Q${x0.toFixed(1)},${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)},${((y0 + y1) / 2).toFixed(1)}`;
  }
  return d + 'Z';
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Whether the eraser at (x, y) touches the stroke. */
export function touches(s: Stroke, x: number, y: number, radius: number): boolean {
  const pts = points(s);
  const reach = radius + s.size / 2;
  if (pts.length === 1) return Math.hypot(pts[0][0] - x, pts[0][1] - y) <= reach;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= reach) return true;
  }
  return false;
}

export function newStroke(tool: InkTool, color: InkColor): Stroke {
  return { tool, color, size: tool === 'marker' ? MARKER_SIZE : PEN_SIZE, pts: [] };
}

/** Lowest point any stroke reaches, so a pad can grow to show it. */
export function inkBottom(strokes: Stroke[]): number {
  let max = 0;
  for (const s of strokes) for (let i = 1; i < s.pts.length; i += 3) max = Math.max(max, s.pts[i] + s.size);
  return max;
}
