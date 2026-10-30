'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { enqueue, listQueue, onQueueChange, removeQueueItem, updateQueueItem, type QueueItem } from './queue';
import { flushQueue } from './flush';
import { submitLedger, type LedgerKind, type LedgerPayload, type LedgerResult } from '@/lib/ledger';
import { LedgerError } from '@/lib/errors';

export type SaveOutcome =
  | { status: 'saved'; result: LedgerResult }
  | { status: 'queued'; item: QueueItem };

interface Ctx {
  online: boolean; items: QueueItem[]; pendingCount: number; syncing: boolean;
  /** Tries the database first. Only returns 'saved' once the server confirmed. */
  save: (kind: LedgerKind, payload: LedgerPayload & { client_txn_id: string }, meta: { customerName: string | null; amount: string }) => Promise<SaveOutcome>;
  syncNow: () => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  discardItem: (id: string) => Promise<void>;
  onSynced: (cb: () => void) => () => void;
}
const SyncContext = createContext<Ctx | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);
  const listeners = useRef(new Set<() => void>());

  const refresh = useCallback(async () => { try { setItems(await listQueue()); } catch { /* IndexedDB unavailable */ } }, []);

  const doFlush = useCallback(async (only?: string) => {
    if (flushing.current) return;
    flushing.current = true; setSyncing(true);
    try {
      const run = () => flushQueue((i) => submitLedger(i.kind, i.payload), only);
      const res = navigator.locks ? await navigator.locks.request('nk-flush', run) : await run();
      if (res && res.synced > 0) listeners.current.forEach((cb) => cb());
    } finally { flushing.current = false; setSyncing(false); await refresh(); }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh().then(() => { if (navigator.onLine) doFlush(); });
    const up = () => { setOnline(true); doFlush(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    const off = onQueueChange(refresh);
    const timer = setInterval(() => { if (navigator.onLine) listQueue().then((q) => { if (q.some((i) => i.status === 'pending')) doFlush(); }); }, 30000);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); off(); clearInterval(timer); };
  }, [doFlush, refresh]);

  const save: Ctx['save'] = useCallback(async (kind, payload, meta) => {
    const queueIt = async () => ({ status: 'queued' as const, item: await enqueue({ id: payload.client_txn_id, kind, payload, customerName: meta.customerName, amount: meta.amount }) });
    if (!navigator.onLine) return queueIt();
    try {
      return { status: 'saved' as const, result: await submitLedger(kind, payload) };
    } catch (e) {
      if (e instanceof LedgerError && !e.isBusinessRejection) return queueIt(); // network/auth: keep it safe locally, say so honestly
      throw e;                                                                  // server refused: show the reason, nothing queued
    }
  }, []);

  const retryItem = useCallback(async (id: string) => { await updateQueueItem(id, { status: 'pending', error: null }); await doFlush(id); }, [doFlush]);
  const discardItem = useCallback(async (id: string) => { await removeQueueItem(id); }, []);
  const onSynced = useCallback((cb: () => void) => { listeners.current.add(cb); return () => { listeners.current.delete(cb); }; }, []);

  const value = useMemo<Ctx>(() => ({
    online, items, pendingCount: items.length, syncing, save, syncNow: () => doFlush(), retryItem, discardItem, onSynced,
  }), [online, items, syncing, save, doFlush, retryItem, discardItem, onSynced]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const c = useContext(SyncContext);
  if (!c) throw new Error('useSync must be used inside SyncProvider');
  return c;
}
