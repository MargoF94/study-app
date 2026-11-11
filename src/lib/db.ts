import Dexie, { type Table } from 'dexie';
import { emptyCollections } from './merge';
import { COLLECTION_NAMES, type BaseRecord, type CollectionName, type Collections } from './types';

/** Device-local key/value data that is never synced (sync token, file fingerprints). */
export interface MetaRow {
  key: string;
  value: unknown;
}

class StudyDb extends Dexie {
  meta!: Table<MetaRow, string>;

  constructor() {
    super('study-log');
    const schema: Record<string, string> = { meta: 'key' };
    for (const name of COLLECTION_NAMES) schema[name] = 'id';
    const { links: _links, files: _files, ...v1 } = schema;
    this.version(1).stores(v1);
    const { files: _files2, ...v2 } = schema;
    this.version(2).stores(v2); // + links
    // + attached files: their records sync like the rest; their bytes are kept in `blobs`.
    this.version(3).stores({ ...schema, blobs: 'id' });
  }

  coll(name: CollectionName): Table<BaseRecord, string> {
    return this.table(name);
  }
}

export const db = new StudyDb();

export async function loadAll(): Promise<Collections> {
  const out = emptyCollections();
  for (const name of COLLECTION_NAMES) {
    (out as unknown as Record<string, BaseRecord[]>)[name] = await db.coll(name).toArray();
  }
  return out;
}

export async function saveRecords(name: CollectionName, records: BaseRecord[]): Promise<void> {
  await db.coll(name).bulkPut(records);
}

/** The bytes of an attached file, kept on this device. id = attachment id. */
export interface BlobRow {
  id: string;
  data: Blob;
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  return (await db.table<BlobRow, string>('blobs').get(id))?.data;
}

export async function putBlob(id: string, data: Blob): Promise<void> {
  await db.table<BlobRow, string>('blobs').put({ id, data });
}

export async function deleteBlob(id: string): Promise<void> {
  await db.table<BlobRow, string>('blobs').delete(id);
}

export async function blobIds(): Promise<Set<string>> {
  return new Set((await db.table<BlobRow, string>('blobs').toCollection().primaryKeys()) as string[]);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
