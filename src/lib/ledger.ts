import { getSupabase } from '@/lib/supabase/client';
import { classifyError, LedgerError } from '@/lib/errors';
import type { PayMethod } from '@/lib/types';

export type LedgerKind = 'purchase' | 'payment' | 'cash_sale';

export interface PurchasePayload {
  customer_id: string; amount: string; description: string | null;
  items: { name: string; quantity: number; unit_price: string }[] | null;
  client_txn_id: string; occurred_at: string;
}
export interface PaymentPayload {
  customer_id: string; amount: string; method: PayMethod; note: string | null;
  client_txn_id: string; occurred_at: string;
}
export interface CashSalePayload { amount: string; note: string | null; client_txn_id: string; occurred_at: string }
export type LedgerPayload = PurchasePayload | PaymentPayload | CashSalePayload;

export interface LedgerResult { id: string; duplicate: boolean; outstanding?: number }

/** Sends one entry to the database. Throws LedgerError. Safe to repeat: the id makes it idempotent. */
export async function submitLedger(kind: LedgerKind, payload: LedgerPayload): Promise<LedgerResult> {
  const sb = getSupabase();
  try {
    let res;
    if (kind === 'purchase') {
      const p = payload as PurchasePayload;
      res = await sb.rpc('create_purchase', {
        p_customer_id: p.customer_id, p_amount: p.amount, p_description: p.description,
        p_items: p.items, p_client_txn_id: p.client_txn_id, p_occurred_at: p.occurred_at,
      });
    } else if (kind === 'payment') {
      const p = payload as PaymentPayload;
      res = await sb.rpc('create_payment', {
        p_customer_id: p.customer_id, p_amount: p.amount, p_method: p.method, p_note: p.note,
        p_client_txn_id: p.client_txn_id, p_occurred_at: p.occurred_at,
      });
    } else {
      const p = payload as CashSalePayload;
      res = await sb.rpc('create_cash_sale', {
        p_amount: p.amount, p_note: p.note, p_client_txn_id: p.client_txn_id, p_occurred_at: p.occurred_at,
      });
    }
    if (res.error) throw classifyError({ ...res.error, status: res.status });
    return res.data as LedgerResult;
  } catch (e) {
    throw e instanceof LedgerError ? e : classifyError(e);
  }
}
