// Choosing questions to study, checking answers and keeping score.
import type { Answer, Progress, Question, Session } from './types';
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

/** How many of your answers to a question are kept. */
export const HISTORY_LIMIT = 100;

export function recordAnswer(p: Progress | undefined, base: { id: string; examId: string }, chosen: number[], right: boolean, now: string): Progress {
  const answer: Answer = { at: now, chosen: [...chosen].sort((a, b) => a - b), right };
  return {
    ...(p ?? { id: base.id, examId: base.examId, createdAt: now, updatedAt: now, attempts: 0, right: 0 }),
    attempts: (p?.attempts ?? 0) + 1,
    right: (p?.right ?? 0) + (right ? 1 : 0),
    last: right ? 'right' : 'wrong',
    lastAt: now,
    history: [...(p?.history ?? []), answer].slice(-HISTORY_LIMIT),
  };
}

export interface AnswerHistory {
  /** Newest first. An answer with no options chosen is one whose options weren't kept. */
  answers: Answer[];
  /** Answers that are only counted (from before each answer was kept). */
  other: number;
  otherRight: number;
}

/** Your answers to a question, for showing. Older answers that weren't kept are counted. */
export function answerHistory(p: Progress | undefined): AnswerHistory {
  if (!p || p.attempts <= 0) return { answers: [], other: 0, otherRight: 0 };
  const kept = p.history ?? [];
  // Nothing kept yet: the last answer is still known (when, and right or wrong).
  const answers = kept.length ? [...kept].reverse() : p.lastAt && p.last ? [{ at: p.lastAt, chosen: [], right: p.last === 'right' }] : [];
  const other = Math.max(0, p.attempts - answers.length);
  const otherRight = Math.max(0, Math.min(other, p.right - answers.filter((a) => a.right).length));
  return { answers, other, otherRight };
}

/**
 * Names a selection (which questions, and the sets and topics left out), so studying it in
 * order again carries on where you left off. Newly imported sets and topics start ticked,
 * so they don't change it.
 */
export function selectionKey(choice: StudyChoice, setIds: string[], topics: string[]): string {
  const offSets = setIds.filter((id) => !choice.setIds.includes(id)).sort();
  const offTopics = topics.filter((t) => !choice.topics.includes(t)).sort();
  return JSON.stringify([choice.which, offSets, offTopics]);
}

/**
 * The question you were on in this selection (in order), if any: kept per selection; else,
 * the first time, the session in progress when it's this same list, or (for all questions)
 * the one you answered last.
 */
export function lastPlace(list: Question[], key: string, which: Which, session: Session | undefined, progress: Map<string, Progress>): string | undefined {
  const kept = session?.resume?.[key];
  if (kept !== undefined) return kept || undefined;
  if (session && !session.key && session.ids.length === list.length && session.ids.every((id, i) => id === list[i].id)) return session.ids[session.index];
  if (which !== 'all') return undefined;
  let last: string | undefined;
  let lastAt = '';
  for (const q of list) {
    const at = progress.get(q.id)?.lastAt ?? '';
    if (at > lastAt) [last, lastAt] = [q.id, at];
  }
  return last;
}

/**
 * Where to carry on in `list` from question `id`: that question, or when it's no longer in the
 * list (answered right while studying "Wrong", say) the next one after it. 0 = the beginning.
 * `all` is every question of the exam in order.
 */
export function resumeIndex(list: Question[], id: string | undefined, all: Question[]): number {
  if (!id) return 0;
  const at = list.findIndex((q) => q.id === id);
  if (at >= 0) return at;
  const order = new Map(all.map((q, i) => [q.id, i]));
  const was = order.get(id);
  if (was === undefined) return 0;
  return Math.max(0, list.findIndex((q) => (order.get(q.id) ?? -1) > was));
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
