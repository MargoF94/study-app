import { describe, expect, test } from 'vitest';
import { decodeText, parseCsv, toCsv } from '../src/lib/import/csv';
import { explanationAnswer, parseSheet, resolveCorrect, splitOptions } from '../src/lib/import/questions';

// The layout of the user's workbook: a title row, then headings, one cell of options.
const workbookRows = [
  ['', 'Practice Exam Questions'],
  ['Q#', 'Question', 'Answer options', 'Correct answer', 'Overall explanation', 'Domain', 'Referance'],
  ['1', 'Which comes first?\n', 'Enable the thing\n\nRun a discovery session\n\nCreate a connector\n\nAdd a channel\n', 'Run a discovery session\n', 'Correct: 2 – Run a discovery session\n\nUnderstand goals first.', 'Setup\n', 'Tips #1\nhttps://example.com/a'],
  ['2', '', '', '', '', '', ''],
  ['3', 'No match here', 'Alpha\n\nBeta', 'Gamma', 'No marker', 'Setup', ''],
  ['4', 'Answer only in the explanation', 'Alpha\n\nBeta\n\nGamma', '', 'Correct: 3 – Gamma', 'Other', ''],
];

describe('parseSheet', () => {
  const p = parseSheet('EN_SET', workbookRows);

  test('finds the heading row under a title', () => {
    expect(p.headerRow).toBe(1);
    expect(p.title).toBe('Practice Exam Questions');
  });

  test('reads a question with options in one cell', () => {
    const q = p.questions[0];
    expect(q.qid).toBe('1');
    expect(q.text).toBe('Which comes first?');
    expect(q.options).toEqual(['Enable the thing', 'Run a discovery session', 'Create a connector', 'Add a channel']);
    expect(q.correct).toEqual([1]);
    expect(q.topic).toBe('Setup');
    expect(q.reference).toBe('Tips #1\nhttps://example.com/a');
    expect(q.explanation.startsWith('Correct: 2')).toBe(true);
    expect(q.problem).toBeUndefined();
  });

  test('skips numbered rows without a question, and flags unmatched answers', () => {
    expect(p.emptyRows).toBe(1);
    expect(p.questions.map((q) => q.qid)).toEqual(['1', '3', '4']);
    expect(p.questions[1].problem).toMatch(/doesn't match/);
    expect(p.questions[1].correct).toEqual([]);
  });

  test('falls back to "Correct: n" in the explanation', () => {
    expect(p.questions[2].correct).toEqual([2]);
  });

  test('a sheet without question columns is reported', () => {
    expect(parseSheet('OUTLINE', [['Section 1', 'Explain things']]).error).toBeTruthy();
  });

  test('one column per option, letters for the answer, several correct', () => {
    const s = parseSheet('csv', [
      ['ID', 'Question', 'Option A', 'Option B', 'Option C', 'Correct', 'Explanation'],
      ['x1', 'Pick two', 'One', 'Two', 'Three', 'A, C', ''],
      ['x2', 'Pick one', 'One', 'Two', '', 'B', ''],
    ]);
    expect(s.questions[0].options).toEqual(['One', 'Two', 'Three']);
    expect(s.questions[0].correct).toEqual([0, 2]);
    expect(s.questions[1].options).toEqual(['One', 'Two']);
    expect(s.questions[1].correct).toEqual([1]);
  });

  test('Japanese headings', () => {
    const s = parseSheet('JP', [
      ['番号', '問題', '選択肢', '正解', '解説'],
      ['1', '正しいものは？', 'あ\n\nい', 'い', '正解: 2 – い'],
    ]);
    expect(s.questions[0].correct).toEqual([1]);
  });

  test('a Q# used twice is kept apart', () => {
    const s = parseSheet('dup', [
      ['Q#', 'Question', 'Answer options', 'Correct answer'],
      ['1', 'First', 'A1\n\nB1', 'A1'],
      ['1', 'Second', 'A2\n\nB2', 'B2'],
    ]);
    expect(s.questions.map((q) => q.qid)).toEqual(['1', '1 (2)']);
    expect(s.questions[1].problem).toMatch(/more than once/);
  });

  test('the same Q# in different sets is fine', () => {
    const s = parseSheet('csv', [
      ['Set', 'Q#', 'Question', 'Answer options', 'Correct answer'],
      ['A', '1', 'First', 'A1\n\nB1', 'A1'],
      ['B', '1', 'Second', 'A2\n\nB2', 'B2'],
    ]);
    expect(s.questions.map((q) => [q.set, q.qid, q.problem])).toEqual([
      ['A', '1', undefined],
      ['B', '1', undefined],
    ]);
  });
});

describe('answers', () => {
  test('splitOptions drops A./1) labels and splits single lines when there are no blank lines', () => {
    expect(splitOptions('A. One\nB. Two\nC. Three')).toEqual(['One', 'Two', 'Three']);
    expect(splitOptions('1) One\n\n2) Two')).toEqual(['One', 'Two']);
    expect(splitOptions('Line one\nstill one\n\nTwo')).toEqual(['Line one\nstill one', 'Two']);
  });

  test('resolveCorrect understands text, letters, numbers and several answers', () => {
    const opts = ['Apple', 'Banana', 'Cherry', 'Date'];
    expect(resolveCorrect('banana', opts, '')).toEqual([1]);
    expect(resolveCorrect('Apple\nCherry', opts, '')).toEqual([0, 2]);
    expect(resolveCorrect('BD', opts, '')).toEqual([1, 3]);
    expect(resolveCorrect('2, 4', opts, '')).toEqual([1, 3]);
    expect(resolveCorrect('C. Cherry', opts, '')).toEqual([2]);
    expect(resolveCorrect('Fig', opts, '')).toBeNull();
  });

  test('explanationAnswer', () => {
    expect(explanationAnswer('Correct: 2 – Something', 4)).toEqual([1]);
    expect(explanationAnswer('正解: 3 – 何か', 4)).toEqual([2]);
    expect(explanationAnswer('Correct answers: 1, 3. Because', 4)).toEqual([0, 2]);
    expect(explanationAnswer('Correct: 9', 4)).toBeNull();
    expect(explanationAnswer('Because reasons', 4)).toBeNull();
  });
});

describe('csv', () => {
  test('quoted fields with commas, quotes and line breaks', () => {
    expect(parseCsv('a,"b, c","say ""hi""\nthere"\r\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'say "hi"\nthere'],
      ['1', '2', '3'],
    ]);
  });

  test('tab-separated', () => {
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  test('round trip', () => {
    const rows = [['Q#', 'Question'], ['1', 'Line 1\nLine 2, with "quotes"']];
    expect(parseCsv(decodeText(new TextEncoder().encode(toCsv(rows))))).toEqual(rows);
  });

  test('Shift-JIS from Japanese Excel', () => {
    // "問題" in Shift-JIS
    const bytes = new Uint8Array([0x96, 0xe2, 0x91, 0xe8]);
    expect(decodeText(bytes)).toBe('問題');
  });
});
