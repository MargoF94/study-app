import { expect, test } from 'vitest';
import { cleanUrl, groupLinks, isWebUrl, linkInfo, linkTitle } from '../src/lib/links';
import { emptyCollections, isDataPath, parseFile, toFiles } from '../src/lib/merge';
import { commitMessage } from '../src/lib/sync.svelte';
import type { Link, LinkGroup } from '../src/lib/types';

test('link kinds come from the address', () => {
  const kind = (u: string) => linkInfo(u).kind;
  expect(kind('https://docs.google.com/spreadsheets/d/abc/edit#gid=0')).toBe('sheet');
  expect(kind('https://docs.google.com/document/d/abc/edit')).toBe('doc');
  expect(kind('https://docs.google.com/presentation/d/abc')).toBe('slides');
  expect(kind('https://drive.google.com/file/d/abc/view')).toBe('drive');
  expect(kind('https://example.com/files/Exam%20Guide.PDF')).toBe('pdf');
  expect(kind('https://www.youtube.com/watch?v=x')).toBe('video');
  expect(linkInfo('https://www.medium.com/@a/b')).toMatchObject({ kind: 'web', label: 'Web page', host: 'medium.com' });
});

test('addresses without https:// work; other schemes are not opened', () => {
  expect(cleanUrl('  docs.google.com/document/d/x ')).toBe('https://docs.google.com/document/d/x');
  expect(cleanUrl('http://a.b')).toBe('http://a.b');
  expect(isWebUrl(cleanUrl('example.com/page'))).toBe(true);
  expect(isWebUrl('javascript:alert(1)')).toBe(false);
  expect(isWebUrl('https://')).toBe(false);
});

test('title falls back to the address', () => {
  expect(linkTitle({ title: ' ', url: 'https://www.example.com/guide/' })).toBe('example.com/guide');
  expect(linkTitle({ title: 'Guide', url: 'https://x.y' })).toBe('Guide');
});

test('links are saved in each exam\'s links.json', () => {
  const c = emptyCollections();
  const T = '2026-10-07T00:00:00.000Z';
  c.links = [
    { id: 'l1', createdAt: T, updatedAt: T, examId: 'e1', url: 'https://x.y', title: 'Exam link', order: 0 },
    { id: 'l2', createdAt: T, updatedAt: T, examId: 'e1', questionId: 'q1', url: 'https://x.y/2', title: '', order: 1 },
  ];
  const files = toFiles(c);
  expect(isDataPath('exams/e1/links.json')).toBe(true);
  expect(parseFile(files.get('exams/e1/links.json')!).links).toEqual(c.links);
});

test('link groups are saved in their own file, next to links.json', () => {
  const c = emptyCollections();
  const T = '2026-11-19T00:00:00.000Z';
  c.linkGroups = [{ id: 'g1', createdAt: T, updatedAt: T, examId: 'e1', name: 'Official docs', order: 0 }];
  c.links = [{ id: 'l1', createdAt: T, updatedAt: T, examId: 'e1', url: 'https://x.y', title: 'Guide', order: 0, groupId: 'g1' }];
  const files = toFiles(c);
  expect(isDataPath('exams/e1/link-groups.json')).toBe(true);
  expect(parseFile(files.get('exams/e1/link-groups.json')!).linkGroups).toEqual(c.linkGroups);
  // links.json keeps only links (an older app rewriting it can't drop the groups)
  expect(parseFile(files.get('exams/e1/links.json')!)).toEqual({ links: c.links });
  expect(commitMessage('exams/e1/link-groups.json')).toBe('Update link groups');
});

test('the exam\'s links by group; links on questions are never grouped', () => {
  const T = '2026-11-19T00:00:00.000Z';
  const g = (id: string, order: number): LinkGroup => ({ id, createdAt: T, updatedAt: T, examId: 'e1', name: id, order });
  const l = (id: string, extra: Partial<Link> = {}): Link => ({ id, createdAt: T, updatedAt: T, examId: 'e1', url: 'https://x.y/' + id, title: '', order: 0, ...extra });
  const links = [l('a', { groupId: 'docs' }), l('b'), l('c', { groupId: 'gone' }), l('d', { groupId: 'docs', questionId: 'q1' }), l('e', { groupId: 'videos' })];
  const out = groupLinks(links, [g('docs', 0), g('videos', 1), g('empty', 2)]);
  expect(out.grouped.map((x) => [x.group.id, x.links.map((y) => y.id)])).toEqual([
    ['docs', ['a']],
    ['videos', ['e']],
    ['empty', []],
  ]);
  // No group, or a group deleted on another device
  expect(out.ungrouped.map((x) => x.id)).toEqual(['b', 'c']);
});
