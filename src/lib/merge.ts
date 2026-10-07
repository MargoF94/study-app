// Merging, and the layout of the private data repo:
//   study.json                         exams, question sets, study sessions, settings
//   exams/<exam>/questions.json        questions
//   exams/<exam>/notes.json            typed notes and highlights
//   exams/<exam>/progress.json         answers and flags
//   exams/<exam>/links.json            links on questions and on the exam
//   exams/<exam>/ink/<question>.json   handwriting for one question
// Records are written one per line with sorted keys, so git diffs show exactly
// which records changed and a file's text (and git sha) only changes with its data.
import { APP_ID, COLLECTION_NAMES, SCHEMA, type BaseRecord, type CollectionName, type Collections } from './types';

export const MAIN_PATH = 'study.json';
const EXAM_FILE = /^exams\/[^/]+\/(questions|notes|progress|links)\.json$/;
const INK_FILE = /^exams\/[^/]+\/ink\/[^/]+\.json$/;

export function isDataPath(path: string): boolean {
  return path === MAIN_PATH || EXAM_FILE.test(path) || INK_FILE.test(path);
}

export function emptyCollections(): Collections {
  return { exams: [], sets: [], questions: [], notes: [], marks: [], ink: [], progress: [], sessions: [], settings: [], links: [] };
}

const byId = (x: BaseRecord, y: BaseRecord) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

/** Merges two versions of a collection; for each id the newest `updatedAt` wins. */
export function mergeRecords<T extends BaseRecord>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const rec of [...a, ...b]) {
    const existing = map.get(rec.id);
    if (!existing || rec.updatedAt > existing.updatedAt) map.set(rec.id, rec);
  }
  return [...map.values()].sort(byId);
}

export function mergeCollections(a: Collections, b: Partial<Collections>): Collections {
  const out = emptyCollections();
  for (const name of COLLECTION_NAMES) {
    (out as unknown as Record<string, BaseRecord[]>)[name] = mergeRecords((a[name] ?? []) as BaseRecord[], (b[name] ?? []) as BaseRecord[]);
  }
  return out;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

/** A data file: header fields, then each collection as an array with one record per line. */
export function serialize(header: Record<string, unknown>, collections: Partial<Record<CollectionName, BaseRecord[]>>): string {
  const head = Object.entries(header).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const names = Object.keys(collections).sort() as CollectionName[];
  const body = names.map((name) => {
    const recs = [...collections[name]!].sort(byId).map((r) => '    ' + JSON.stringify(sortKeys(r)));
    return recs.length ? `  ${JSON.stringify(name)}: [\n${recs.join(',\n')}\n  ]` : `  ${JSON.stringify(name)}: []`;
  });
  return '{\n' + [...head, ...body].join(',\n') + '\n}\n';
}

/** File names stay readable and safe whatever the id looks like. */
const safe = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '_');

export const examDir = (examId: string) => `exams/${safe(examId)}`;

/** Every file the data repo should hold for these collections, path → text. */
export function toFiles(c: Collections): Map<string, string> {
  const header = { app: APP_ID, schema: SCHEMA };
  const files = new Map<string, string>();
  files.set(MAIN_PATH, serialize(header, { exams: c.exams, sets: c.sets, sessions: c.sessions, settings: c.settings }));

  const groups = new Map<string, Partial<Record<CollectionName, BaseRecord[]>>>();
  const add = (path: string, name: CollectionName, rec: BaseRecord) => {
    let g = groups.get(path);
    if (!g) groups.set(path, (g = {}));
    (g[name] ??= []).push(rec);
  };
  for (const q of c.questions) add(`${examDir(q.examId)}/questions.json`, 'questions', q);
  for (const n of c.notes) add(`${examDir(n.examId)}/notes.json`, 'notes', n);
  for (const m of c.marks) add(`${examDir(m.examId)}/notes.json`, 'marks', m);
  for (const p of c.progress) add(`${examDir(p.examId)}/progress.json`, 'progress', p);
  for (const l of c.links) add(`${examDir(l.examId)}/links.json`, 'links', l);
  for (const i of c.ink) add(`${examDir(i.examId)}/ink/${safe(i.questionId)}.json`, 'ink', i);
  for (const [path, g] of groups) {
    if (path.endsWith('/notes.json')) {
      g.notes ??= [];
      g.marks ??= [];
    }
    files.set(path, serialize(header, g));
  }
  return files;
}

/** Reads any data file or a full backup; returns its collections. */
export function parseFile(text: string): Partial<Collections> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is damaged or is not a Study Log file.');
  }
  if (!data || typeof data !== 'object' || data.app !== APP_ID) throw new Error('This file is not a Study Log file.');
  if (typeof data.schema === 'number' && data.schema > SCHEMA) {
    throw new Error('Your data was saved by a newer version of the app. Close and reopen the app to update it.');
  }
  const out: Partial<Collections> = {};
  for (const name of COLLECTION_NAMES) {
    if (Array.isArray(data[name])) (out as Record<string, unknown>)[name] = data[name];
  }
  return out;
}

/** A single-file backup of everything (Settings → Download backup). */
export function toBackup(c: Collections, savedAt: string): string {
  const all: Partial<Record<CollectionName, BaseRecord[]>> = {};
  for (const name of COLLECTION_NAMES) all[name] = c[name];
  return serialize({ app: APP_ID, schema: SCHEMA, backup: true, savedAt }, all);
}

/** Git's blob id for a text file, used to tell whether a file in the repo already has this content. */
export async function gitBlobSha(text: string): Promise<string> {
  const body = new TextEncoder().encode(text);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head);
  all.set(body, head.length);
  const hash = await crypto.subtle.digest('SHA-1', all);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
