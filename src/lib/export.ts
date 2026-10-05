// Exports an exam's questions as CSV in the same layout the import reads, so a
// file can go out, be edited in Excel, and come back in as an update.
import { toCsv } from './import/csv';
import type { Question, QuestionSet } from './types';

export const EXPORT_HEADER = ['Set', 'Q#', 'Question', 'Answer options', 'Correct answer', 'Overall explanation', 'Domain', 'Reference'];

export function questionsCsv(questions: Question[], sets: QuestionSet[]): string {
  const setName = new Map(sets.map((s) => [s.id, s.name]));
  const rows = questions.map((q) => [
    setName.get(q.setId) ?? '',
    q.qid,
    q.text,
    q.options.join('\n\n'),
    q.correct.map((i) => q.options[i] ?? '').join('\n'),
    q.explanation,
    q.topic,
    q.reference,
  ]);
  return toCsv([EXPORT_HEADER, ...rows]);
}
