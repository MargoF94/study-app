// Data model. Every record has id, createdAt, updatedAt and an optional
// `deleted` tombstone so deletions sync between devices.

export const APP_ID = 'study-log';
/** Version of the data files. Older app versions refuse newer data instead of dropping it. */
export const SCHEMA = 1;

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Exam extends BaseRecord {
  name: string;
  order: number;
}

/** A group of questions within an exam, usually one sheet or CSV file. */
export interface QuestionSet extends BaseRecord {
  examId: string;
  name: string;
  order: number;
}

export interface Question extends BaseRecord {
  examId: string;
  setId: string;
  /** The question's number or id in the source file ("Q#"). Used to match updated files. */
  qid: string;
  /** Position within its set. */
  order: number;
  topic: string;
  text: string;
  options: string[];
  /** Indexes into `options`. More than one means "choose N". */
  correct: number[];
  explanation: string;
  reference: string;
  /** Imported with a problem (e.g. the correct answer didn't match an option). */
  needsReview?: boolean;
}

/** The typed note on a question. id = question id. */
export interface Note extends BaseRecord {
  examId: string;
  text: string;
}

/** Where a highlight sits: the question text, the explanation, or option n. */
export type MarkField = 'q' | 'e' | `o${number}`;

export interface MarkRange {
  f: MarkField;
  /** Character offsets in that field's text, end exclusive. */
  s: number;
  e: number;
}

/** Text highlights on a question. id = question id. */
export interface Marks extends BaseRecord {
  examId: string;
  ranges: MarkRange[];
}

export type InkTool = 'pen' | 'marker';
export type InkColor = 'ink' | 'blue' | 'red' | 'green' | 'yellow' | 'pink';

export interface Stroke {
  tool: InkTool;
  color: InkColor;
  /** Pen size in page units. */
  size: number;
  /** Flat list: x, y, pressure, x, y, pressure… in page units (the page is PAGE_WIDTH wide). */
  pts: number[];
}

/** Handwriting on a question: over the question itself ("page") or on its memo pad. id = `${questionId}.page|memo`. */
export interface Ink extends BaseRecord {
  examId: string;
  questionId: string;
  area: 'page' | 'memo';
  strokes: Stroke[];
  /** Memo pad height in page units. */
  height?: number;
  /** Memo pad width in page units (memos made before it was stored are PAGE_WIDTH wide). */
  width?: number;
}

/** A link to a web page, Google Doc or Sheet, PDF… on a question, or on the whole exam when questionId is empty. */
export interface Link extends BaseRecord {
  examId: string;
  questionId?: string;
  url: string;
  title: string;
  order: number;
}

/** What happened when you answered a question. id = question id. */
export interface Progress extends BaseRecord {
  examId: string;
  attempts: number;
  right: number;
  last?: 'right' | 'wrong';
  lastAt?: string;
  flagged?: boolean;
}

/** The study session in progress for an exam, so any device can continue it. id = exam id. */
export interface Session extends BaseRecord {
  ids: string[];
  index: number;
  label: string;
}

export type Theme = 'system' | 'light' | 'dark';

export interface Settings extends BaseRecord {
  theme: Theme;
}

export interface Collections {
  exams: Exam[];
  sets: QuestionSet[];
  questions: Question[];
  notes: Note[];
  marks: Marks[];
  ink: Ink[];
  progress: Progress[];
  sessions: Session[];
  settings: Settings[];
  links: Link[];
}

export type CollectionName = keyof Collections;

export const COLLECTION_NAMES: CollectionName[] = ['exams', 'sets', 'questions', 'notes', 'marks', 'ink', 'progress', 'sessions', 'settings', 'links'];

/** Width of a question page and memo pad in page units. Handwriting is stored in these units. */
export const PAGE_WIDTH = 440;

/** Width of a new memo pad in page units: wide, so it fills an iPad screen. */
export const MEMO_WIDTH = 900;
