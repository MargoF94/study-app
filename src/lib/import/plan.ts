// Compares an imported file with the questions already in an exam, and turns
// the result into records to save. Questions are matched within their set by
// Q#, or by their text when there is no Q#. Matched questions keep their id, so
// notes, highlights, handwriting and progress stay with them.
import type { Exam, Question, QuestionSet } from '../types';
import { collator, newId, normalize } from '../util';
import type { ParsedQuestion } from './questions';

export interface IncomingSet {
  name: string;
  questions: ParsedQuestion[];
}

export type ChangeField = 'text' | 'options' | 'correct' | 'explanation' | 'topic' | 'reference';

export interface FieldChange {
  field: ChangeField;
  before: string;
  after: string;
}

export interface PlanItem {
  kind: 'new' | 'changed' | 'same';
  setName: string;
  incoming: ParsedQuestion;
  existing?: Question;
  changes: FieldChange[];
}

export interface ImportPlan {
  items: PlanItem[];
  /** Questions in the imported sets that the file no longer has. */
  missing: Question[];
  counts: { new: number; changed: number; same: number; problems: number };
}

export const FIELD_LABELS: Record<ChangeField, string> = {
  text: 'Question',
  options: 'Answer options',
  correct: 'Correct answer',
  explanation: 'Explanation',
  topic: 'Topic',
  reference: 'Reference',
};

const optionsText = (options: string[]) => options.map((o, i) => `${i + 1}. ${o}`).join('\n');
const correctText = (correct: number[]) => (correct.length ? correct.map((i) => i + 1).join(', ') : '(none)');

function compare(q: Question, p: ParsedQuestion): FieldChange[] {
  const out: FieldChange[] = [];
  const check = (field: ChangeField, before: string, after: string) => {
    if (before !== after) out.push({ field, before, after });
  };
  check('text', q.text, p.text);
  check('options', optionsText(q.options), optionsText(p.options));
  check('correct', correctText(q.correct), correctText(p.correct));
  check('explanation', q.explanation, p.explanation);
  check('topic', q.topic, p.topic);
  check('reference', q.reference, p.reference);
  return out;
}

export const sameName = (a: string, b: string) => normalize(a) === normalize(b);

export function planImport(incoming: IncomingSet[], sets: QuestionSet[], questions: Question[]): ImportPlan {
  const items: PlanItem[] = [];
  const missing: Question[] = [];
  for (const inc of incoming) {
    const set = sets.find((s) => !s.deleted && sameName(s.name, inc.name));
    const existing = set ? questions.filter((q) => q.setId === set.id && !q.deleted) : [];
    const byQid = new Map(existing.filter((q) => q.qid).map((q) => [q.qid, q]));
    const byText = new Map(existing.map((q) => [normalize(q.text), q]));
    const used = new Set<string>();
    for (const p of inc.questions) {
      let match = p.qid ? byQid.get(p.qid) : undefined;
      if (!match && !p.qid) match = byText.get(normalize(p.text));
      if (match && used.has(match.id)) match = undefined;
      if (match) {
        used.add(match.id);
        const changes = compare(match, p);
        items.push({ kind: changes.length ? 'changed' : 'same', setName: inc.name, incoming: p, existing: match, changes });
      } else {
        items.push({ kind: 'new', setName: inc.name, incoming: p, changes: [] });
      }
    }
    missing.push(...existing.filter((q) => !used.has(q.id)));
  }
  const count = (k: PlanItem['kind']) => items.filter((i) => i.kind === k).length;
  return {
    items,
    missing,
    counts: { new: count('new'), changed: count('changed'), same: count('same'), problems: items.filter((i) => i.incoming.problem).length },
  };
}

export interface ImportRecords {
  exam?: Exam;
  sets: QuestionSet[];
  questions: Question[];
  removed: Question[];
}

/**
 * Records to save for a plan. `exam` is the exam to add to (or a new one when `newExamName` is set).
 * Questions that are the same are left alone; their order is updated only if it moved.
 */
export function buildImport(
  plan: ImportPlan,
  target: { exam?: Exam; newExamName?: string; examOrder?: number },
  sets: QuestionSet[],
  removeMissing: boolean,
  now: string,
): ImportRecords {
  let exam: Exam | undefined;
  let examId: string;
  if (target.exam) examId = target.exam.id;
  else {
    examId = newId();
    exam = { id: examId, createdAt: now, updatedAt: now, name: target.newExamName?.trim() || 'New exam', order: target.examOrder ?? 0 };
  }
  const examSets = sets.filter((s) => s.examId === examId && !s.deleted);
  const newSets: QuestionSet[] = [];
  const setFor = (name: string): QuestionSet => {
    const found = [...examSets, ...newSets].find((s) => sameName(s.name, name));
    if (found) return found;
    const s: QuestionSet = { id: newId(), createdAt: now, updatedAt: now, examId, name, order: examSets.length + newSets.length };
    newSets.push(s);
    return s;
  };

  const out: Question[] = [];
  const orderBySet = new Map<string, number>();
  for (const item of plan.items) {
    const set = setFor(item.setName);
    const order = orderBySet.get(set.id) ?? 0;
    orderBySet.set(set.id, order + 1);
    const p = item.incoming;
    const fields = {
      qid: p.qid,
      topic: p.topic,
      text: p.text,
      options: p.options,
      correct: p.correct,
      explanation: p.explanation,
      reference: p.reference,
      needsReview: p.problem ? true : undefined,
    };
    if (item.existing) {
      if (item.kind === 'same' && item.existing.order === order && !!item.existing.needsReview === !!fields.needsReview) continue;
      out.push({ ...item.existing, ...fields, order });
    } else {
      out.push({ id: newId(), createdAt: now, updatedAt: now, examId, setId: set.id, order, ...fields });
    }
  }
  return { exam, sets: newSets, questions: out, removed: removeMissing ? plan.missing : [] };
}

/** Sorts questions the way they appear: by set, then position in the set. */
export function questionOrder(sets: QuestionSet[]) {
  const setOrder = new Map(sets.map((s) => [s.id, s.order]));
  return (a: Question, b: Question) =>
    (setOrder.get(a.setId) ?? 0) - (setOrder.get(b.setId) ?? 0) || a.order - b.order || collator.compare(a.qid, b.qid);
}

/** A file's questions grouped into sets: by its "Set" column if it has one, otherwise all in one set named after the sheet or file. */
export function incomingSets(sheetName: string, questions: ParsedQuestion[]): IncomingSet[] {
  const groups = new Map<string, ParsedQuestion[]>();
  for (const q of questions) {
    const name = q.set?.trim() || sheetName;
    const list = groups.get(name);
    if (list) list.push(q);
    else groups.set(name, [q]);
  }
  return [...groups].map(([name, qs]) => ({ name, questions: qs }));
}
