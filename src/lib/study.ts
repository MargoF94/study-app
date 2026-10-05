// Choosing questions to study, checking answers and keeping score.
import type { Progress, Question } from './types';
import { shuffle } from './util';

export type Which = 'all' | 'new' | 'wrong' | 'flagged';
export type Order = 'order' | 'shuffle';

export interface StudyChoice {
  setIds: string[];
  /** Topics to include; an empty topic name stands for questions without one. */
  topics: string[];
  which: Which;
  order: Order;
}

export function matchesWhich(p: Progress | undefined, which: Which): boolean {
  switch (which) {
    case 'new':
      return !p || p.attempts === 0;
    case 'wrong':
      return p?.last === 'wrong';
    case 'flagged':
      return !!p?.flagged;
    default:
      return true;
  }
}

/** Questions for a study session, in the order they'll be shown. `questions` must already be in file order. */
export function pickQuestions(questions: Question[], progress: Map<string, Progress>, choice: StudyChoice, random = Math.random): Question[] {
  const sets = new Set(choice.setIds);
  const topics = new Set(choice.topics);
  const picked = questions.filter((q) => sets.has(q.setId) && topics.has(q.topic) && matchesWhich(progress.get(q.id), choice.which));
  return choice.order === 'shuffle' ? shuffle(picked, random) : picked;
}

/** Right only when exactly the correct options are chosen. */
export function isRight(chosen: number[], correct: number[]): boolean {
  return chosen.length === correct.length && correct.every((i) => chosen.includes(i));
}

export function recordAnswer(p: Progress | undefined, base: { id: string; examId: string }, right: boolean, now: string): Progress {
  return {
    ...(p ?? { id: base.id, examId: base.examId, createdAt: now, updatedAt: now, attempts: 0, right: 0 }),
    attempts: (p?.attempts ?? 0) + 1,
    right: (p?.right ?? 0) + (right ? 1 : 0),
    last: right ? 'right' : 'wrong',
    lastAt: now,
  };
}

export interface ExamStats {
  total: number;
  answered: number;
  right: number;
  wrong: number;
  flagged: number;
}

/** Answered = tried at least once; right/wrong = the last answer given. */
export function examStats(questions: Question[], progress: Map<string, Progress>): ExamStats {
  const s: ExamStats = { total: questions.length, answered: 0, right: 0, wrong: 0, flagged: 0 };
  for (const q of questions) {
    const p = progress.get(q.id);
    if (!p) continue;
    if (p.attempts > 0) s.answered++;
    if (p.last === 'right') s.right++;
    if (p.last === 'wrong') s.wrong++;
    if (p.flagged) s.flagged++;
  }
  return s;
}

export function describeChoice(choice: StudyChoice, setNames: string[], allSets: boolean, allTopics: boolean): string {
  const which = { all: 'All', new: 'New', wrong: 'Wrong', flagged: 'Flagged' }[choice.which];
  const where = allSets ? (setNames.length > 1 ? 'all sets' : setNames[0] ?? '') : setNames.join(', ');
  return [which, where, allTopics ? '' : `${choice.topics.length} topic${choice.topics.length === 1 ? '' : 's'}`, choice.order === 'shuffle' ? 'shuffled' : 'in order']
    .filter(Boolean)
    .join(' · ');
}
