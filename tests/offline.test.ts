import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { enqueue, listQueue, removeQueueItem } from '@/lib/offline/queue';
import { flushQueue } from '@/lib/offline/flush';
import { LedgerError, classifyError } from '@/lib/errors';

const mk = (id: string, amount = '100.00') => ({ id, kind: 'purchase' as const, customerName: 'Ravi', amount,
  payload: { customer_id: 'c1', amount, description: null, items: null, client_txn_id: id, occurred_at: new Date().toISOString() } });

beforeEach(async () => { for (const i of await listQueue()) await removeQueueItem(i.id); });

describe('offline outbox', () => {
  it('stores entries and keeps them pending when the network is down', async () => {
    await enqueue(mk('a')); await enqueue(mk('b'));
    const res = await flushQueue(async () => { throw new LedgerError('NETWORK'); });
    expect(res).toMatchObject({ synced: 0, stillPending: 2, stoppedBy: 'network' });
    expect((await listQueue()).map((i) => i.status)).toEqual(['pending', 'pending']);
  });
  it('removes entries only after the server confirms, oldest first', async () => {
    await enqueue(mk('a')); await new Promise((r) => setTimeout(r, 5)); await enqueue(mk('b'));
    const order: string[] = [];
    const res = await flushQueue(async (i) => { order.push(i.id); return { id: i.id, duplicate: false }; });
    expect(order).toEqual(['a', 'b']); expect(res.synced).toBe(2); expect(await listQueue()).toHaveLength(0);
  });
  it('re-queuing the same id never duplicates (idempotent key)', async () => { await enqueue(mk('a')); await enqueue(mk('a')); expect(await listQueue()).toHaveLength(1); });
  it('a server rejection is kept as FAILED, never silently dropped, and does not block the rest', async () => {
    await enqueue(mk('bad')); await new Promise((r) => setTimeout(r, 5)); await enqueue(mk('good'));
    const res = await flushQueue(async (i) => { if (i.id === 'bad') throw new LedgerError('PAYMENT_EXCEEDS_OUTSTANDING'); return {}; });
    expect(res).toMatchObject({ synced: 1, failed: 1 });
    const left = await listQueue(); expect(left).toHaveLength(1); expect(left[0]).toMatchObject({ id: 'bad', status: 'failed', error: 'PAYMENT_EXCEEDS_OUTSTANDING' });
  });
  it('expired login keeps everything pending', async () => {
    await enqueue(mk('a')); const res = await flushQueue(async () => { throw new LedgerError('AUTH_EXPIRED'); });
    expect(res.stoppedBy).toBe('auth'); expect(await listQueue()).toHaveLength(1);
  });
  it('a server "duplicate" reply counts as synced (already saved)', async () => {
    await enqueue(mk('a')); const res = await flushQueue(async () => ({ id: 'x', duplicate: true })); expect(res.synced).toBe(1); expect(await listQueue()).toHaveLength(0);
  });
});

describe('error classification', () => {
  it('maps database codes', () => { expect(classifyError({ code: 'P0001', message: 'PAYMENT_EXCEEDS_OUTSTANDING' }).code).toBe('PAYMENT_EXCEEDS_OUTSTANDING'); });
  it('treats fetch failures as network (retryable)', () => { const e = classifyError(new TypeError('Failed to fetch')); expect(e.code).toBe('NETWORK'); expect(e.isBusinessRejection).toBe(false); });
  it('treats expired JWT as auth', () => { expect(classifyError({ code: 'PGRST301', message: 'JWT expired' }).code).toBe('AUTH_EXPIRED'); });
  it('unknown errors are retryable, not rejections', () => { expect(classifyError({ message: 'weird' }).isBusinessRejection).toBe(false); });
});
