import { describe, expect, test } from 'vitest';
import { diffWords } from '../src/lib/diff';
import { questionsCsv } from '../src/lib/export';
import { parseCsv, decodeText } from '../src/lib/import/csv';
import { buildImport, incomingSets, planImport } from '../src/lib/import/plan';
import { parseSheet, type ParsedQuestion } from '../src/lib/import/questions';
import { addPoint, newStroke, strokePath, touches } from '../src/lib/ink';
import { addMark, overlapsMark, remapOptionMarks, removeMark, segments } from '../src/lib/marks';
import { emptyCollections, isDataPath, parseFile, toFiles } from '../src/lib/merge';
import { commitMessage } from '../src/lib/sync.svelte';
import { examStats, isRight, pickQuestions, recordAnswer } from '../src/lib/study';
import type { Question, QuestionSet } from '../src/lib/types';

const T = '2026-10-01T00:00:00.000Z';

function pq(qid: string, text: string, extra: Partial<ParsedQuestion> = {}): ParsedQuestion {
  return { row: 1, qid, text, options: ['A', 'B'], correct: [0], explanation: '', topic: 'T', reference: '', ...extra };
}

function q(id: string, setId: string, qid: string, text: string, extra: Partial<Question> = {}): Question {
  return { id, createdAt: T, updatedAt: T, examId: 'e1', setId, qid, order: 0, topic: 'T', text, options: ['A', 'B'], correct: [0], explanation: '', reference: '', ...extra };
}

const set1: QuestionSet = { id: 's1', createdAt: T, updatedAt: T, examId: 'e1', name: 'EN_QUESTIONS SET 1', order: 0 };

describe('import plan', () => {
  test('a first import is all new, and creates the exam and its sets', () => {
    const plan = planImport([{ name: 'Sheet A', questions: [pq('1', 'One'), pq('2', 'Two')] }], [], []);
    expect(plan.counts).toEqual({ new: 2, changed: 0, same: 0, problems: 0 });
    const r = buildImport(plan, { newExamName: 'My exam' }, [], false, T);
    expect(r.exam?.name).toBe('My exam');
    expect(r.sets.map((s) => s.name)).toEqual(['Sheet A']);
    expect(r.questions.map((x) => [x.qid, x.order, x.setId === r.sets[0].id, x.examId === r.exam!.id])).toEqual([
      ['1', 0, true, true],
      ['2', 1, true, true],
    ]);
  });

  test('an updated file matches by Q#, keeps ids, and lists what changed', () => {
    const existing = [q('a', 's1', '1', 'One'), q('b', 's1', '2', 'Two', { order: 1 }), q('c', 's1', '3', 'Three', { order: 2 })];
    const plan = planImport(
      [{ name: 'en_questions set 1', questions: [pq('1', 'One'), pq('2', 'Two, reworded', { correct: [1] }), pq('4', 'Four')] }],
      [set1],
      existing,
    );
    expect(plan.counts).toEqual({ new: 1, changed: 1, same: 1, problems: 0 });
    const changed = plan.items.find((i) => i.kind === 'changed')!;
    expect(changed.existing?.id).toBe('b');
    expect(changed.changes.map((c) => c.field)).toEqual(['text', 'correct']);
    expect(plan.missing.map((m) => m.id)).toEqual(['c']);

    const keep = buildImport(plan, { exam: { id: 'e1', createdAt: T, updatedAt: T, name: 'E', order: 0 } }, [set1], false, T);
    expect(keep.exam).toBeUndefined();
    expect(keep.sets).toEqual([]);
    // "One" is unchanged and still first, so it isn't rewritten.
    expect(keep.questions.map((x) => x.id).filter((id) => ['a', 'b'].includes(id))).toEqual(['b']);
    expect(keep.questions.find((x) => x.id === 'b')?.text).toBe('Two, reworded');
    expect(keep.removed).toEqual([]);

    const drop = buildImport(plan, { exam: { id: 'e1', createdAt: T, updatedAt: T, name: 'E', order: 0 } }, [set1], true, T);
    expect(drop.removed.map((x) => x.id)).toEqual(['c']);
  });

  test('questions without a Q# are matched by their text', () => {
    const plan = planImport([{ name: set1.name, questions: [pq('', 'Same  text')] }], [set1], [q('a', 's1', '', 'same text')]);
    expect(plan.items[0].existing?.id).toBe('a');
  });

  test('a Set column splits a CSV into sets', () => {
    const sets = incomingSets('file', [pq('1', 'x', { set: 'A' }), pq('2', 'y'), pq('3', 'z', { set: 'A' })]);
    expect(sets.map((s) => [s.name, s.questions.length])).toEqual([
      ['A', 2],
      ['file', 1],
    ]);
  });

  test('export → import gives the same questions back', () => {
    const questions = [
      q('a', 's1', '1', 'One, with "quotes"\nand a line', { options: ['Yes', 'No', 'Maybe'], correct: [0, 2], explanation: 'Because', topic: 'Consent', reference: 'https://x.y' }),
    ];
    const csv = questionsCsv(questions, [set1]);
    const sheet = parseSheet('file', parseCsv(decodeText(new TextEncoder().encode(csv))));
    const plan = planImport(incomingSets(sheet.name, sheet.questions), [set1], questions);
    expect(plan.counts).toEqual({ new: 0, changed: 0, same: 1, problems: 0 });
  });
});

describe('highlights', () => {
  test('add joins touching ranges; remove splits them', () => {
    let r = addMark([], { f: 'q', s: 2, e: 5 });
    r = addMark(r, { f: 'q', s: 5, e: 9 });
    r = addMark(r, { f: 'o1', s: 0, e: 3 });
    expect(r).toEqual([
      { f: 'o1', s: 0, e: 3 },
      { f: 'q', s: 2, e: 9 },
    ]);
    r = removeMark(r, { f: 'q', s: 4, e: 6 });
    expect(r).toEqual([
      { f: 'o1', s: 0, e: 3 },
      { f: 'q', s: 2, e: 4 },
      { f: 'q', s: 6, e: 9 },
    ]);
    expect(overlapsMark(r, { f: 'q', s: 3, e: 5 })).toBe(true);
    expect(overlapsMark(r, { f: 'q', s: 4, e: 6 })).toBe(false);
  });

  test('segments', () => {
    expect(segments('Hello world', [{ f: 'q', s: 6, e: 11 }, { f: 'e', s: 0, e: 2 }], 'q')).toEqual([
      { text: 'Hello ', marked: false },
      { text: 'world', marked: true },
    ]);
    // A highlight past the end (the text was shortened) is cut off.
    expect(segments('Hi', [{ f: 'q', s: 1, e: 10 }], 'q')).toEqual([
      { text: 'H', marked: false },
      { text: 'i', marked: true },
    ]);
  });

  test('option highlights follow their option', () => {
    const r = remapOptionMarks(
      [
        { f: 'o0', s: 0, e: 1 },
        { f: 'o2', s: 0, e: 1 },
        { f: 'q', s: 0, e: 1 },
      ],
      [1, 0, -1],
    );
    expect(r).toEqual([
      { f: 'o1', s: 0, e: 1 },
      { f: 'q', s: 0, e: 1 },
    ]);
  });
});

describe('data files', () => {
  test('each exam has its own files; handwriting is one file per question', () => {
    const c = emptyCollections();
    c.exams = [{ id: 'e1', createdAt: T, updatedAt: T, name: 'E', order: 0 }];
    c.questions = [q('a', 's1', '1', 'One')];
    c.notes = [{ id: 'a', createdAt: T, updatedAt: T, examId: 'e1', text: 'n' }];
    c.ink = [{ id: 'a.page', createdAt: T, updatedAt: T, examId: 'e1', questionId: 'a', area: 'page', strokes: [] }];
    const files = toFiles(c);
    expect([...files.keys()].sort()).toEqual(['exams/e1/ink/a.json', 'exams/e1/notes.json', 'exams/e1/questions.json', 'study.json']);
    for (const path of files.keys()) expect(isDataPath(path)).toBe(true);
    expect(parseFile(files.get('exams/e1/notes.json')!).notes).toEqual(c.notes);
    expect(parseFile(files.get('exams/e1/notes.json')!).marks).toEqual([]);
    expect(commitMessage('exams/e1/ink/a.json')).toBe('Update handwriting');
    expect(() => parseFile('{"app":"study-log","schema":99}')).toThrow(/newer version/);
  });
});

describe('studying', () => {
  const qs = [q('a', 's1', '1', 'One', { topic: 'X' }), q('b', 's1', '2', 'Two', { topic: 'Y' }), q('c', 's2', '1', 'Three', { topic: 'X' })];
  const progress = new Map([
    ['a', { id: 'a', examId: 'e1', createdAt: T, updatedAt: T, attempts: 2, right: 1, last: 'wrong' as const, flagged: true }],
    ['b', { id: 'b', examId: 'e1', createdAt: T, updatedAt: T, attempts: 1, right: 1, last: 'right' as const }],
  ]);

  test('pickQuestions filters by set, topic and status', () => {
    const ids = (w: 'all' | 'new' | 'wrong' | 'flagged', sets = ['s1', 's2'], topics = ['X', 'Y']) =>
      pickQuestions(qs, progress, { setIds: sets, topics, which: w, order: 'order' }).map((x) => x.id);
    expect(ids('all')).toEqual(['a', 'b', 'c']);
    expect(ids('new')).toEqual(['c']);
    expect(ids('wrong')).toEqual(['a']);
    expect(ids('flagged')).toEqual(['a']);
    expect(ids('all', ['s1'], ['X'])).toEqual(['a']);
    expect(pickQuestions(qs, progress, { setIds: ['s1', 's2'], topics: ['X', 'Y'], which: 'all', order: 'shuffle' }, () => 0).length).toBe(3);
  });

  test('answers and stats', () => {
    expect(isRight([2, 0], [0, 2])).toBe(true);
    expect(isRight([0], [0, 2])).toBe(false);
    const p = recordAnswer(undefined, { id: 'c', examId: 'e1' }, true, T);
    expect([p.attempts, p.right, p.last]).toEqual([1, 1, 'right']);
    const p2 = recordAnswer(p, { id: 'c', examId: 'e1' }, false, T);
    expect([p2.attempts, p2.right, p2.last]).toEqual([2, 1, 'wrong']);
    expect(examStats(qs, progress)).toEqual({ total: 3, answered: 2, right: 1, wrong: 1, flagged: 1 });
  });
});

describe('ink', () => {
  test('strokes become paths, and the eraser finds them', () => {
    const s = newStroke('pen', 'blue');
    addPoint(s, 10, 10, 0.5);
    addPoint(s, 10, 10, 0.5); // repeated point is dropped
    addPoint(s, 50.123, 10, 0.5);
    expect(s.pts).toEqual([10, 10, 0.5, 50.1, 10, 0.5]);
    expect(strokePath(s)).toMatch(/^M/);
    expect(touches(s, 30, 14, 4)).toBe(true);
    expect(touches(s, 30, 40, 4)).toBe(false);
  });
});

test('diffWords', () => {
  expect(diffWords('the absence of an opt-out', 'a missing opt-out')).toEqual([
    { type: 'del', text: 'the absence of an' },
    { type: 'ins', text: 'a missing' },
    { type: 'same', text: ' opt-out' },
  ]);
});
