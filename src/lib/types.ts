export type Lang = 'ta' | 'en';
export type TxnType = 'PURCHASE' | 'PAYMENT' | 'ADJUSTMENT';
export type PayMethod = 'CASH' | 'UPI' | 'OTHER';

export interface Customer {
  id: string; shop_id: string; customer_no: number; name: string; phone: string | null;
  address: string | null; notes: string | null; opening_balance: number; is_active: boolean; created_at: string;
}
export interface CustomerBalance {
  customer_id: string; opening_balance: number; total_purchases: number; total_payments: number;
  total_adjustments: number; outstanding: number; last_purchase_at: string | null;
  last_payment_at: string | null; last_txn_at: string | null;
}
export interface CustomerRow extends Customer { outstanding: number; last_txn_at: string | null }
export interface Txn {
  id: string; customer_id: string; type: TxnType; amount: number; description: string | null;
  payment_method: PayMethod | null; occurred_at: string; created_at: string;
  reverses_transaction_id: string | null; is_reversed: boolean; customer_name?: string;
}
export interface TxnItem { id: string; transaction_id: string; name: string; quantity: number; unit_price: number; line_total: number }
export interface Product { id: string; name: string; unit: string | null; default_price: number; is_active: boolean }
export interface DashboardSummary {
  today_credit: number; today_payments: number; today_cash_sales: number; today_sales: number;
  today_txn_count: number; total_outstanding: number; customer_count: number;
  pending_customers: { id: string; name: string; phone: string | null; outstanding: number; last_txn_at: string | null }[];
  week: { day: string; payments: number; credit: number }[];
  recent: (Omit<Txn, 'created_at' | 'reverses_transaction_id'>)[];
}
export interface ReportData {
  days: { day: string; credit_purchases: number; payments: number; cash_sales: number }[];
  totals: { credit_purchases: number; payments: number; cash_sales: number };
  total_sales: number; outstanding_now: number; customers_pending: number;
}
