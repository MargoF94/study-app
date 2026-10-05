// Text highlights: character ranges in a question's text, options and explanation.
import type { MarkField, MarkRange } from './types';

/** Adds a highlight, joining it with any it touches. */
export function addMark(ranges: MarkRange[], add: MarkRange): MarkRange[] {
  if (add.e <= add.s) return ranges;
  let { s, e } = add;
  const others: MarkRange[] = [];
  for (const r of ranges) {
    if (r.f === add.f && r.s <= e && r.e >= s) {
      s = Math.min(s, r.s);
      e = Math.max(e, r.e);
    } else others.push(r);
  }
  return sortMarks([...others, { f: add.f, s, e }]);
}

/** Removes highlighting from part of a field (splitting a highlight if needed). */
export function removeMark(ranges: MarkRange[], cut: MarkRange): MarkRange[] {
  const out: MarkRange[] = [];
  for (const r of ranges) {
    if (r.f !== cut.f || r.e <= cut.s || r.s >= cut.e) {
      out.push(r);
      continue;
    }
    if (r.s < cut.s) out.push({ f: r.f, s: r.s, e: cut.s });
    if (r.e > cut.e) out.push({ f: r.f, s: cut.e, e: r.e });
  }
  return sortMarks(out);
}

export function overlapsMark(ranges: MarkRange[], sel: MarkRange): boolean {
  return ranges.some((r) => r.f === sel.f && r.s < sel.e && r.e > sel.s);
}

function sortMarks(ranges: MarkRange[]): MarkRange[] {
  return ranges.sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : a.s - b.s));
}

export interface Segment {
  text: string;
  marked: boolean;
}

/** A field's text cut into plain and highlighted pieces. Ranges past the end (after an edit) are ignored. */
export function segments(text: string, ranges: MarkRange[], field: MarkField): Segment[] {
  const mine = ranges.filter((r) => r.f === field && r.s < text.length).sort((a, b) => a.s - b.s);
  const out: Segment[] = [];
  let pos = 0;
  for (const r of mine) {
    const s = Math.max(r.s, pos);
    const e = Math.min(r.e, text.length);
    if (e <= s) continue;
    if (s > pos) out.push({ text: text.slice(pos, s), marked: false });
    out.push({ text: text.slice(s, e), marked: true });
    pos = e;
  }
  if (pos < text.length || out.length === 0) out.push({ text: text.slice(pos), marked: false });
  return out;
}

/** After options are reordered or removed: `moved[old] = new index`, or -1 when the option is gone. */
export function remapOptionMarks(ranges: MarkRange[], moved: number[]): MarkRange[] {
  const out: MarkRange[] = [];
  for (const r of ranges) {
    if (r.f[0] !== 'o') {
      out.push(r);
      continue;
    }
    const to = moved[Number(r.f.slice(1))];
    if (to !== undefined && to >= 0) out.push({ ...r, f: `o${to}` });
  }
  return sortMarks(out);
}
