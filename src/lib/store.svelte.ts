// In-memory data backed by IndexedDB. Components read `store.*`;
// all writes go through the methods here so they persist and trigger sync.
import * as db from './db';
import { questionOrder, type ImportRecords } from './import/plan';
import { emptyCollections, mergeCollections } from './merge';
import { COLLECTION_NAMES } from './types';
import type { BaseRecord, CollectionName, Collections, Exam, Ink, Link, Marks, Note, Progress, Question, QuestionSet, Session, Settings } from './types';
import { collator, nowIso } from './util';

type Listener = () => void;

const live = <T extends BaseRecord>(list: T[]) => list.filter((r) => !r.deleted);
const byId = <T extends BaseRecord>(list: T[]) => new Map(live(list).map((r) => [r.id, r]));

function groupBy<T>(list: T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    const g = out.get(k);
    if (g) g.push(x);
    else out.set(k, [x]);
  }
  return out;
}

const DEFAULT_SETTINGS: Settings = { id: 'settings', createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z', theme: 'system' };

class Store {
  data = $state.raw<Collections>(emptyCollections());
  loaded = $state(false);

  exams = $derived(live(this.data.exams).sort((a, b) => a.order - b.order || collator.compare(a.name, b.name)));
  examsById = $derived(byId(this.data.exams));
  sets = $derived(live(this.data.sets).sort((a, b) => a.order - b.order || collator.compare(a.name, b.name)));
  setsById = $derived(byId(this.data.sets));
  setsByExam = $derived(groupBy(this.sets, (s) => s.examId));
  questionsById = $derived(byId(this.data.questions));
  /** Each exam's questions, in file order (set by set). */
  questionsByExam = $derived.by(() => {
    const sort = questionOrder(this.sets);
    const groups = groupBy(live(this.data.questions), (q) => q.examId);
    for (const list of groups.values()) list.sort(sort);
    return groups;
  });
  notes = $derived(byId(this.data.notes));
  marks = $derived(byId(this.data.marks));
  ink = $derived(byId(this.data.ink));
  progress = $derived(byId(this.data.progress));
  sessions = $derived(byId(this.data.sessions));
  /** Each exam's links, in the order they were added. */
  linksByExam = $derived(groupBy(live(this.data.links).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)), (l) => l.examId));
  linksById = $derived(byId(this.data.links));
  settings = $derived<Settings>(this.data.settings.find((s) => s.id === 'settings' && !s.deleted) ?? DEFAULT_SETTINGS);

  #listeners = new Set<Listener>();

  // Other open tabs share their changes here, so every tab's copy stays current.
  #channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('study-log-data') : null;

  constructor() {
    this.#channel?.addEventListener('message', (e: MessageEvent) => {
      const { name, records, local } = e.data as { name: CollectionName; records: BaseRecord[]; local: boolean };
      if (!this.loaded || !COLLECTION_NAMES.includes(name)) return;
      this.data = mergeCollections(this.data, { [name]: records });
      if (local) this.#emit();
    });
  }

  #broadcast(name: CollectionName, records: BaseRecord[], local: boolean) {
    try {
      this.#channel?.postMessage({ name, records, local });
    } catch {
      /* another tab catches up when it next loads */
    }
  }

  async load(): Promise<void> {
    this.data = await db.loadAll();
    this.loaded = true;
  }

  /** Called after every local change (used to schedule sync). */
  onChange(fn: Listener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit() {
    for (const fn of this.#listeners) fn();
  }

  /** Inserts or updates records, stamping updatedAt. */
  async put<K extends CollectionName>(name: K, records: Collections[K][number][]): Promise<void> {
    if (records.length === 0) return;
    const now = nowIso();
    // Snapshot: records may contain reactive proxies, which IndexedDB cannot store.
    const stamped = records.map((r) => ({ ...$state.snapshot(r), createdAt: r.createdAt || now, updatedAt: now }));
    const ids = new Set(stamped.map((r) => r.id));
    const next = [...(this.data[name] as BaseRecord[]).filter((r) => !ids.has(r.id)), ...stamped];
    this.data = { ...this.data, [name]: next };
    await db.saveRecords(name, stamped);
    this.#broadcast(name, stamped, true);
    this.#emit();
  }

  /** Soft-deletes records so the deletion syncs to other devices. */
  async remove<K extends CollectionName>(name: K, records: BaseRecord[]): Promise<void> {
    await this.put(name, records.map((r) => ({ ...r, deleted: true })) as Collections[K][number][]);
  }

  /**
   * Merges records from another copy (sync or backup). Only records newer than the local
   * ones are written. Does not trigger sync. Returns the number of changed records.
   */
  async applyRemote(remote: Partial<Collections>): Promise<number> {
    let count = 0;
    const changed: [CollectionName, BaseRecord[]][] = [];
    for (const name of COLLECTION_NAMES) {
      const incoming = (remote[name] ?? []) as BaseRecord[];
      if (!incoming.length) continue;
      const local = new Map((this.data[name] as BaseRecord[]).map((r) => [r.id, r]));
      const newer = incoming.filter((r) => {
        const mine = local.get(r.id);
        return !mine || r.updatedAt > mine.updatedAt;
      });
      if (newer.length) {
        changed.push([name, newer]);
        count += newer.length;
      }
    }
    if (count === 0) return 0;
    this.data = mergeCollections(this.data, remote);
    for (const [name, records] of changed) {
      await db.saveRecords(name, records);
      this.#broadcast(name, records, false);
    }
    return count;
  }

  // ---- queries -------------------------------------------------------

  exam(id: string): Exam | undefined {
    return this.examsById.get(id);
  }

  question(id: string): Question | undefined {
    return this.questionsById.get(id);
  }

  questionsOf(examId: string): Question[] {
    return this.questionsByExam.get(examId) ?? [];
  }

  setsOf(examId: string): QuestionSet[] {
    return this.setsByExam.get(examId) ?? [];
  }

  /** Topics in the order they first appear. */
  topicsOf(examId: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const q of this.questionsOf(examId)) {
      if (!seen.has(q.topic)) {
        seen.add(q.topic);
        out.push(q.topic);
      }
    }
    return out;
  }

  linksOf(examId: string): Link[] {
    return this.linksByExam.get(examId) ?? [];
  }

  /** A question's own links (not the exam's). */
  linksFor(q: Question): Link[] {
    return this.linksOf(q.examId).filter((l) => l.questionId === q.id);
  }

  inkFor(questionId: string, area: Ink['area']): Ink | undefined {
    return this.ink.get(`${questionId}.${area}`);
  }

  // ---- writes --------------------------------------------------------

  async saveExam(e: Exam): Promise<void> {
    await this.put('exams', [e]);
  }

  /** Deletes an exam with everything in it. */
  async deleteExam(e: Exam): Promise<void> {
    const mine = <T extends BaseRecord & { examId: string }>(list: T[]) => list.filter((r) => r.examId === e.id && !r.deleted);
    await this.remove('questions', mine(this.data.questions));
    await this.remove('sets', mine(this.data.sets));
    await this.remove('notes', mine(this.data.notes));
    await this.remove('marks', mine(this.data.marks));
    await this.remove('ink', mine(this.data.ink));
    await this.remove('progress', mine(this.data.progress));
    await this.remove('links', mine(this.data.links));
    const session = this.sessions.get(e.id);
    if (session) await this.remove('sessions', [session]);
    await this.remove('exams', [e]);
  }

  async saveSet(s: QuestionSet): Promise<void> {
    await this.put('sets', [s]);
  }

  async deleteSet(s: QuestionSet): Promise<void> {
    const qs = this.data.questions.filter((q) => q.setId === s.id && !q.deleted);
    const ids = new Set(qs.map((q) => q.id));
    await this.remove('links', this.data.links.filter((l) => l.questionId && ids.has(l.questionId) && !l.deleted));
    await this.remove('questions', qs);
    await this.remove('sets', [s]);
  }

  async saveQuestion(q: Question): Promise<void> {
    await this.put('questions', [q]);
  }

  async deleteQuestion(q: Question): Promise<void> {
    await this.remove('links', this.data.links.filter((l) => l.questionId === q.id && !l.deleted));
    await this.remove('questions', [q]);
  }

  async applyImport(r: ImportRecords): Promise<void> {
    if (r.exam) await this.put('exams', [r.exam]);
    await this.put('sets', r.sets);
    await this.put('questions', r.questions);
    if (r.removed.length) await this.remove('questions', r.removed);
  }

  async saveNote(q: Question, text: string): Promise<void> {
    const existing = this.notes.get(q.id);
    if ((existing?.text ?? '') === text) return;
    const note: Note = existing ? { ...existing, text } : { id: q.id, examId: q.examId, createdAt: '', updatedAt: '', text };
    await this.put('notes', [note]);
  }

  async saveMarks(q: Question, ranges: Marks['ranges']): Promise<void> {
    const existing = this.marks.get(q.id);
    await this.put('marks', [existing ? { ...existing, ranges } : { id: q.id, examId: q.examId, createdAt: '', updatedAt: '', ranges }]);
  }

  async saveInk(q: Question, area: Ink['area'], patch: Pick<Ink, 'strokes'> & Partial<Pick<Ink, 'height' | 'width'>>): Promise<void> {
    const id = `${q.id}.${area}`;
    const existing = this.ink.get(id);
    await this.put('ink', [existing ? { ...existing, ...patch } : { id, examId: q.examId, questionId: q.id, area, createdAt: '', updatedAt: '', ...patch }]);
  }

  async saveLink(l: Link): Promise<void> {
    await this.put('links', [l]);
  }

  async deleteLink(l: Link): Promise<void> {
    await this.remove('links', [l]);
  }

  async saveProgress(p: Progress): Promise<void> {
    await this.put('progress', [p]);
  }

  async toggleFlag(q: Question): Promise<void> {
    const p = this.progress.get(q.id);
    await this.put('progress', [p ? { ...p, flagged: !p.flagged } : { id: q.id, examId: q.examId, createdAt: '', updatedAt: '', attempts: 0, right: 0, flagged: true }]);
  }

  async saveSession(s: Session): Promise<void> {
    await this.put('sessions', [s]);
  }

  async saveSettings(patch: Partial<Settings>): Promise<void> {
    await this.put('settings', [{ ...this.settings, ...patch, id: 'settings' }]);
  }
}

export const store = new Store();
