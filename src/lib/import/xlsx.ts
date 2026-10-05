// Reads the cell text of every sheet in an Excel .xlsx workbook, in the browser.
// An .xlsx file is a zip of XML files: the workbook lists the sheets, shared
// strings hold most text, and each sheet holds its rows of cells.
import { unzipSync, strFromU8 } from 'fflate';

export interface Sheet {
  name: string;
  /** Rows of cell text; empty cells are "". */
  rows: string[][];
}

function xml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

/** Direct children with this local name. */
function kids(el: Element, name: string): Element[] {
  return [...el.children].filter((c) => c.localName === name);
}

/** Excel escapes some characters as _xHHHH_ (e.g. _x000D_ for a carriage return). */
function unescapeExcel(text: string): string {
  return text.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\r\n?/g, '\n');
}

/** The text of a shared or inline string: its <t>, or the <t> of each run. Phonetic guides (<rPh>) are skipped. */
function stringText(si: Element): string {
  let out = '';
  for (const child of [...si.children]) {
    if (child.localName === 't') out += child.textContent ?? '';
    else if (child.localName === 'r') for (const t of kids(child, 't')) out += t.textContent ?? '';
  }
  return unescapeExcel(out);
}

/** "AB12" → 27 (zero-based column). */
export function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function formatNumber(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  // Floating-point noise like 0.30000000000000004 → 0.3
  return String(Number.isInteger(n) ? n : parseFloat(n.toPrecision(15)));
}

function resolveTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = ('xl/' + target).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}

export function isXlsx(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK": a zip file
}

export function readXlsx(bytes: Uint8Array): Sheet[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("This doesn't look like an Excel workbook (.xlsx).");
  }
  const text = (path: string) => (files[path] ? strFromU8(files[path]) : null);
  const workbook = text('xl/workbook.xml');
  if (!workbook) throw new Error("This doesn't look like an Excel workbook (.xlsx). Old .xls files: save as .xlsx or CSV first.");

  const rels = new Map<string, string>();
  const relsText = text('xl/_rels/workbook.xml.rels');
  if (relsText) {
    for (const r of [...xml(relsText).getElementsByTagName('*')].filter((e) => e.localName === 'Relationship')) {
      rels.set(r.getAttribute('Id') ?? '', resolveTarget(r.getAttribute('Target') ?? ''));
    }
  }

  const shared: string[] = [];
  const sharedText = text('xl/sharedStrings.xml');
  if (sharedText) {
    const root = xml(sharedText).documentElement;
    for (const si of kids(root, 'si')) shared.push(stringText(si));
  }

  const sheets: Sheet[] = [];
  const sheetEls = [...xml(workbook).getElementsByTagName('*')].filter((e) => e.localName === 'sheet');
  sheetEls.forEach((s, i) => {
    const name = s.getAttribute('name') ?? `Sheet${i + 1}`;
    const rid = s.getAttribute('r:id') ?? [...s.attributes].find((a) => a.localName === 'id')?.value ?? '';
    const path = rels.get(rid) ?? `xl/worksheets/sheet${i + 1}.xml`;
    const body = text(path);
    sheets.push({ name, rows: body ? readSheet(body, shared) : [] });
  });
  return sheets;
}

function readSheet(body: string, shared: string[]): string[][] {
  const doc = xml(body);
  const rows: string[][] = [];
  const rowEls = [...doc.getElementsByTagName('*')].filter((e) => e.localName === 'row');
  let nextRow = 0;
  for (const rowEl of rowEls) {
    const r = Number(rowEl.getAttribute('r')) - 1;
    const rowIndex = Number.isFinite(r) && r >= 0 ? r : nextRow;
    nextRow = rowIndex + 1;
    const cells: string[] = [];
    let nextCol = 0;
    for (const c of kids(rowEl, 'c')) {
      const ref = c.getAttribute('r');
      const col = ref ? columnIndex(ref) : nextCol;
      nextCol = col + 1;
      const type = c.getAttribute('t');
      const v = kids(c, 'v')[0]?.textContent ?? '';
      let value: string;
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = kids(c, 'is')[0] ? stringText(kids(c, 'is')[0]) : '';
      else if (type === 'str' || type === 'e') value = unescapeExcel(v);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else value = v ? formatNumber(v) : '';
      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    while (rows.length < rowIndex) rows.push([]);
    rows[rowIndex] = cells;
  }
  return rows;
}
