import { expect, test } from 'vitest';
import { asJpegName, badgeOf, canOpen, extensionOf, fitWithin, formatBytes, isImage, kindOf, nameOf, pastedName, typeOf } from '../src/lib/files';
import { attachmentPath, emptyCollections, isDataPath, parseFile, toFiles } from '../src/lib/merge';
import { commitMessage } from '../src/lib/sync.svelte';
import type { Attachment } from '../src/lib/types';

const T = '2026-11-10T00:00:00.000Z';

test('attached files are listed in each exam\'s files.json; the files themselves are not data files', () => {
  const c = emptyCollections();
  const a: Attachment = {
    id: 'f1',
    createdAt: T,
    updatedAt: T,
    examId: 'e1',
    questionId: 'q1',
    name: 'Screenshot 1.png',
    type: 'image/png',
    size: 1234,
    path: attachmentPath('e1', 'f1', 'png'),
    width: 800,
    height: 600,
    order: 0,
  };
  c.files = [a];
  const files = toFiles(c);
  expect(a.path).toBe('exams/e1/files/f1.png');
  expect(isDataPath('exams/e1/files.json')).toBe(true);
  expect(parseFile(files.get('exams/e1/files.json')!).files).toEqual([a]);
  // The bytes are never read as data, even a .json attachment.
  expect(isDataPath('exams/e1/files/f1.png')).toBe(false);
  expect(isDataPath('exams/e1/files/f2.json')).toBe(false);
  expect(commitMessage('exams/e1/files.json')).toBe('Update files');
});

test('file paths stay safe whatever the ids and names look like', () => {
  expect(attachmentPath('a/b', 'x y', 'PNG')).toBe('exams/a_b/files/x_y.png');
  expect(attachmentPath('e', 'id', '')).toBe('exams/e/files/id');
  expect(attachmentPath('e', 'id', 'p.d/f')).toBe('exams/e/files/id.pdf');
});

test('file kinds and names', () => {
  expect(extensionOf('Guide.PDF', '')).toBe('pdf');
  expect(extensionOf('notes', 'image/jpeg')).toBe('jpg');
  expect(extensionOf('notes', 'application/x-unknown')).toBe('');
  expect(typeOf('plan.docx', '')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  expect(typeOf('blob', '')).toBe('application/octet-stream');
  expect(typeOf('a.png', 'image/png')).toBe('image/png');
  expect(badgeOf('Deck.pptx', '')).toBe('PPTX');
  expect(badgeOf('noext', '')).toBe('FILE');
  expect(kindOf('a.xlsx', '')).toBe('sheet');
  expect(kindOf('a.pdf', 'application/pdf')).toBe('pdf');
  expect(kindOf('a.png', 'image/png')).toBe('image');
  expect(asJpegName('IMG_0001.HEIC')).toBe('IMG_0001.jpg');
});

test('pictures are shown in the app; files that could run code are never opened', () => {
  expect(isImage('image/png')).toBe(true);
  expect(isImage('image/heic')).toBe(true);
  expect(isImage('image/svg+xml')).toBe(false);
  expect(canOpen({ type: 'application/pdf', name: 'a.pdf' })).toBe(true);
  expect(canOpen({ type: 'text/html', name: 'a.html' })).toBe(false);
  expect(canOpen({ type: 'image/svg+xml', name: 'a.svg' })).toBe(false);
});

test('pasted pictures get a readable name', () => {
  const when = new Date(2026, 10, 10, 9, 5, 7);
  expect(pastedName('image/png', when)).toBe('Pasted image 2026-11-10 09.05.07.png');
  expect(nameOf({ name: 'image.png', type: 'image/png' }, when)).toBe('Pasted image 2026-11-10 09.05.07.png');
  expect(nameOf({ name: '', type: 'image/jpeg' }, when)).toBe('Pasted image 2026-11-10 09.05.07.jpg');
  expect(nameOf({ name: 'Diagram.png', type: 'image/png' }, when)).toBe('Diagram.png');
});

test('large pictures are scaled to fit, never enlarged', () => {
  expect(fitWithin(5120, 2880, 2560)).toEqual({ width: 2560, height: 1440 });
  expect(fitWithin(2048, 2732, 2560)).toEqual({ width: 1919, height: 2560 });
  expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 });
});

test('sizes read naturally', () => {
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(150 * 1024)).toBe('150 KB');
  expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB');
});
