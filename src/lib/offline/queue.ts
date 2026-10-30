/**
 * Outbox for entries that could not reach the database yet. Stored in IndexedDB.
 * Rules: an entry is only ever removed after the server confirmed it (or the owner
 * explicitly discards it). Failures are kept and shown, never dropped silently.
 */
import type { LedgerKind, LedgerPayload } from '@/lib/ledger';

export interface QueueItem {
  id: string;                    // == client_txn_id (idempotency key)
  kind: LedgerKind;
  payload: LedgerPayload;
  customerName: string | null;
  amount: string;                // decimal string, for display
  status: 'pending' | 'failed';
  error: string | null;          // error code
  attempts: number;
  createdAt: string;
}

const DB = 'namma-kadai';
const STORE = 'outbox';
const EVENT = 'nk-outbox-changed';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r.result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}
function notify() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT)); }

export async function enqueue(item: Omit<QueueItem, 'status' | 'error' | 'attempts' | 'createdAt'>): Promise<QueueItem> {
  const full: QueueItem = { ...item, status: 'pending', error: null, attempts: 0, createdAt: new Date().toISOString() };
  await tx('readwrite', (s) => s.put(full));   // put (not add): re-queuing the same id never duplicates
  notify();
  return full;
}
export async function listQueue(): Promise<QueueItem[]> {
  const all = await tx<QueueItem[]>('readonly', (s) => s.getAll());
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function updateQueueItem(id: string, patch: Partial<QueueItem>): Promise<void> {
  const cur = await tx<QueueItem | undefined>('readonly', (s) => s.get(id));
  if (!cur) return;
  await tx('readwrite', (s) => s.put({ ...cur, ...patch, id }));
  notify();
}
export async function removeQueueItem(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
  notify();
}
export function onQueueChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
