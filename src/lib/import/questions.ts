// Turns rows from a sheet or CSV file into questions. The heading row is found
// automatically (a title above it is skipped), and columns are recognised by
// name. Two layouts work:
//  - all options in one "Answer options" cell, separated by blank lines;
//  - one column per option (Option A, Option B… or Option 1, Option 2…).
// The correct answer can be the option's text, letters (B, A,C) or numbers (2, 1,3);
// failing that, "Correct: 2" at the start of the explanation is used.
import { normalize } from '../util';

export type Field = 'id' | 'question' | 'options' | 'correct' | 'explanation' | 'topic' | 'reference' | 'set';

const HEADERS: Record<Field, string[]> = {
  id: ['q#', '#', 'id', 'no', 'no.', 'q', 'q no', 'q no.', 'number', 'question number', 'question no', 'question no.', 'question id', 'qid', '問題番号', '番号', 'no'],
  question: ['question', 'question text', 'questions text', '問題', '設問', '問題文', '質問'],
  options: ['answer options', 'options', 'choices', 'answer choices', 'answers options', 'option list', '選択肢', '回答選択肢'],
  correct: ['correct answer', 'correct answers', 'correct', 'answer', 'answers', 'correct option', 'correct options', 'right answer', '正解', '答え', '解答'],
  explanation: ['overall explanation', 'explanation', 'explanations', 'rationale', '解説', '説明'],
  topic: ['domain', 'topic', 'section', 'category', 'subject', '分野', 'カテゴリ', 'カテゴリー', 'トピック', 'ドメイン'],
  reference: ['reference', 'referance', 'references', 'source', 'link', 'url', '参考', '出典', '参照'],
  set: ['set', 'question set'],
};

const FIELD_BY_HEADER = new Map<string, Field>();
for (const [field, names] of Object.entries(HEADERS) as [Field, string[]][]) for (const n of names) FIELD_BY_HEADER.set(n, field);

/** "Option B" / "choice 2" / "B" → its zero-based position. */
function optionColumn(header: string): number | null {
  const m = header.match(/^(?:option|choice|answer|選択肢)?\s*[_\-\s]?\s*([a-h]|[1-8])$/);
  if (!m) return null;
  const k = m[1];
  return /[a-h]/.test(k) ? k.charCodeAt(0) - 97 : Number(k) - 1;
}

export interface Column {
  header: string;
  field: Field | null;
  /** For one-column-per-option files. */
  option?: number;
}

export interface ParsedQuestion {
  /** Row number in the file (1 = first row), for messages. */
  row: number;
  qid: string;
  topic: string;
  text: string;
  options: string[];
  correct: number[];
  explanation: string;
  reference: string;
  set?: string;
  problem?: string;
}

export interface ParsedSheet {
  name: string;
  /** Text above the heading row, e.g. a title. */
  title: string;
  headerRow: number;
  columns: Column[];
  questions: ParsedQuestion[];
  /** Rows with a number but no question text yet. */
  emptyRows: number;
  /** Rows that couldn't be used, with why. */
  skipped: { row: number; message: string }[];
  /** Set when the sheet has no question columns at all. */
  error?: string;
}

const clean = (s: string | undefined) => (s ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();

function readHeader(cells: string[]): Column[] {
  return cells.map((raw) => {
    const header = clean(raw);
    const key = normalize(header).replace(/[：:]$/, '');
    const field = FIELD_BY_HEADER.get(key) ?? null;
    if (field) return { header, field };
    const option = optionColumn(key);
    return option !== null ? { header, field: null, option } : { header, field: null };
  });
}

function findHeader(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cols = readHeader(rows[i] ?? []);
    const has = (f: Field) => cols.some((c) => c.field === f);
    if (has('question') && (has('options') || cols.some((c) => c.option !== undefined))) return i;
  }
  return -1;
}

/** Splits an "Answer options" cell: blank lines between options, or one per line if there are none. */
export function splitOptions(cell: string): string[] {
  const text = clean(cell);
  if (!text) return [];
  let parts = text.split(/\n\s*\n/);
  if (parts.length === 1) parts = text.split('\n');
  parts = parts.map((p) => p.trim()).filter(Boolean);
  // "A. …", "1) …" labels on every option are dropped (the app numbers options itself).
  const label = /^(?:[A-Ha-h]|[1-8])\s*[.)．）:：]\s+/;
  if (parts.length > 1 && parts.every((p) => label.test(p))) parts = parts.map((p) => p.replace(label, ''));
  return parts;
}

const LIST_SEP = /\s*(?:,|、|;|&|\band\b|\/)\s*|\s+/i;

/** "B", "A, C", "AC", "2", "1,3" → zero-based indexes, or null. */
function parseLabels(text: string, count: number): number[] | null {
  const t = text.normalize('NFKC').trim().replace(/^(?:options?|answers?)\s*/i, '');
  if (!t) return null;
  let tokens: string[];
  if (/^[A-Ha-h]{2,8}$/.test(t) && t.length <= count) tokens = t.split('');
  else tokens = t.split(LIST_SEP).filter(Boolean);
  const out: number[] = [];
  for (const tok of tokens) {
    let n: number;
    if (/^[A-Ha-h]$/.test(tok)) n = tok.toUpperCase().charCodeAt(0) - 65;
    else if (/^\d+$/.test(tok)) n = Number(tok) - 1;
    else return null;
    if (n < 0 || n >= count) return null;
    if (!out.includes(n)) out.push(n);
  }
  return out.length ? out.sort((a, b) => a - b) : null;
}

/** "Correct: 2 – …", "正解: 2 – …", "Correct answers: 1, 3 …" at the start of an explanation. */
export function explanationAnswer(explanation: string, count: number): number[] | null {
  const m = explanation
    .normalize('NFKC')
    .match(/^\s*(?:correct(?:\s+answers?)?|answers?|正解)\s*[:：]\s*((?:\d+|[A-H])(?:\s*(?:,|、|&|and)\s*(?:\d+|[A-H]))*)(?![A-Za-z0-9])/i);
  return m ? parseLabels(m[1], count) : null;
}

/** Works out which options are correct. */
export function resolveCorrect(cell: string, options: string[], explanation: string): number[] | null {
  const want = clean(cell);
  const norm = options.map(normalize);
  if (want) {
    const whole = norm.indexOf(normalize(want));
    if (whole >= 0) return [whole];
    // Several answers written out, one per line (or separated by ; or |).
    const parts = want.split(/\n+|\s*[;|]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const idx = parts.map((p) => norm.indexOf(normalize(p)));
      if (idx.every((i) => i >= 0)) return [...new Set(idx)].sort((a, b) => a - b);
    }
    const labels = parseLabels(want, options.length);
    if (labels) return labels;
    // "2 – The option text" or "B. The option text"
    const m = want.match(/^\s*([A-Ha-h]|[1-8])\s*[.)．）:：–—-]\s*(.+)$/s);
    if (m) {
      const byText = norm.indexOf(normalize(m[2]));
      if (byText >= 0) return [byText];
    }
  }
  return explanationAnswer(explanation, options.length);
}

export function parseSheet(name: string, rows: string[][]): ParsedSheet {
  const headerRow = findHeader(rows);
  const result: ParsedSheet = { name, title: '', headerRow, columns: [], questions: [], emptyRows: 0, skipped: [] };
  if (headerRow < 0) {
    result.error = 'No question columns found';
    return result;
  }
  result.title = rows
    .slice(0, headerRow)
    .map((r) => r.map(clean).filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n');
  const columns = readHeader(rows[headerRow]);
  result.columns = columns;
  const col = (f: Field) => columns.findIndex((c) => c.field === f);
  const at = { id: col('id'), question: col('question'), options: col('options'), correct: col('correct'), explanation: col('explanation'), topic: col('topic'), reference: col('reference'), set: col('set') };
  const optionCols = columns
    .map((c, i) => ({ i, n: c.option }))
    .filter((x): x is { i: number; n: number } => x.n !== undefined)
    .sort((a, b) => a.n - b.n);
  const get = (cells: string[], i: number) => (i >= 0 ? clean(cells[i]) : '');
  const seen = new Map<string, number>();

  for (let r = headerRow + 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (!cells.some((c) => clean(c))) continue;
    const row = r + 1;
    const text = get(cells, at.question);
    let qid = get(cells, at.id);
    if (!text) {
      result.emptyRows++;
      continue;
    }
    const options = at.options >= 0 ? splitOptions(cells[at.options] ?? '') : optionCols.map((o) => clean(cells[o.i])).filter(Boolean);
    if (options.length < 2) {
      result.skipped.push({ row, message: options.length ? 'only one answer option' : 'no answer options' });
      continue;
    }
    const explanation = get(cells, at.explanation);
    const correct = resolveCorrect(get(cells, at.correct), options, explanation);
    let problem: string | undefined = correct ? undefined : "the correct answer doesn't match any option";
    const set = get(cells, at.set);
    if (qid) {
      // Numbers only need to be unique within a set.
      const key = `${set}\u0000${qid}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (n > 1) {
        problem = `Q# ${qid} is used more than once; this one is saved as ${qid} (${n})`;
        qid = `${qid} (${n})`;
      }
    }
    result.questions.push({
      row,
      qid,
      text,
      options,
      correct: correct ?? [],
      explanation,
      topic: get(cells, at.topic),
      reference: get(cells, at.reference),
      set: set || undefined,
      problem,
    });
  }
  return result;
}
