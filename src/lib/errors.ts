/** Turns database / network errors into a stable code the UI can translate. */
export type LedgerErrorCode =
  | 'NOT_AUTHORIZED' | 'INVALID_AMOUNT' | 'AMOUNT_TOO_LARGE' | 'INVALID_DATE' | 'INVALID_REQUEST'
  | 'CUSTOMER_NOT_FOUND' | 'TRANSACTION_NOT_FOUND' | 'PAYMENT_EXCEEDS_OUTSTANDING' | 'ITEMS_TOTAL_MISMATCH'
  | 'REASON_REQUIRED' | 'ALREADY_REVERSED' | 'CANNOT_REVERSE_REVERSAL' | 'SETUP_CLOSED' | 'IMMUTABLE_RECORD'
  | 'NETWORK' | 'AUTH_EXPIRED' | 'UNKNOWN';

const KNOWN: LedgerErrorCode[] = [
  'NOT_AUTHORIZED', 'INVALID_AMOUNT', 'AMOUNT_TOO_LARGE', 'INVALID_DATE', 'INVALID_REQUEST', 'CUSTOMER_NOT_FOUND',
  'TRANSACTION_NOT_FOUND', 'PAYMENT_EXCEEDS_OUTSTANDING', 'ITEMS_TOTAL_MISMATCH', 'REASON_REQUIRED',
  'ALREADY_REVERSED', 'CANNOT_REVERSE_REVERSAL', 'SETUP_CLOSED', 'IMMUTABLE_RECORD',
];

export class LedgerError extends Error {
  constructor(public code: LedgerErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'LedgerError';
  }
  /** true = the server understood and refused it (retrying will never help) */
  get isBusinessRejection() { return this.code !== 'NETWORK' && this.code !== 'AUTH_EXPIRED' && this.code !== 'UNKNOWN'; }
}

interface PgLike { message?: string; code?: string; status?: number }

export function classifyError(err: unknown): LedgerError {
  if (err instanceof LedgerError) return err;
  const e = (err ?? {}) as PgLike;
  const msg = String(e.message ?? err ?? '');
  for (const k of KNOWN) if (msg.includes(k)) return new LedgerError(k, msg);
  if (e.code === 'PGRST301' || /JWT|not authenticated|invalid token/i.test(msg) || e.status === 401) return new LedgerError('AUTH_EXPIRED', msg);
  if (e.code === '23505') return new LedgerError('UNKNOWN', msg); // unique violation: treated as retryable (idempotent id)
  if (!e.code && /fetch|network|Failed to|Load failed|timeout|offline/i.test(msg)) return new LedgerError('NETWORK', msg);
  if (e.status && e.status >= 500) return new LedgerError('NETWORK', msg);
  return new LedgerError('UNKNOWN', msg);
}
