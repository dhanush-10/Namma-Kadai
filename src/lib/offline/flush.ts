import { LedgerError } from '@/lib/errors';
import { listQueue, removeQueueItem, updateQueueItem, type QueueItem } from './queue';

export interface FlushResult { synced: number; failed: number; stillPending: number; stoppedBy: 'network' | 'auth' | null }

type Sender = (item: QueueItem) => Promise<unknown>;

/**
 * Sends queued entries oldest-first.
 *  - success (including "duplicate": server already has it) -> removed
 *  - server refused it (e.g. payment too large) -> kept as 'failed' with the reason
 *  - network / auth trouble -> stop, keep everything pending
 */
export async function flushQueue(send: Sender, only?: string): Promise<FlushResult> {
  const items = (await listQueue()).filter((i) => (only ? i.id === only : i.status === 'pending'));
  const res: FlushResult = { synced: 0, failed: 0, stillPending: 0, stoppedBy: null };
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    try {
      await send(item);
      await removeQueueItem(item.id);
      res.synced++;
    } catch (e) {
      const err = e instanceof LedgerError ? e : new LedgerError('UNKNOWN', String(e));
      if (err.isBusinessRejection) {
        await updateQueueItem(item.id, { status: 'failed', error: err.code, attempts: item.attempts + 1 });
        res.failed++;
      } else {
        await updateQueueItem(item.id, { error: err.code, attempts: item.attempts + 1 });
        res.stillPending += items.length - idx;
        res.stoppedBy = err.code === 'AUTH_EXPIRED' ? 'auth' : 'network';
        break;
      }
    }
  }
  return res;
}
