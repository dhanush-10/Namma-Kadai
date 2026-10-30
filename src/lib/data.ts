import { getSupabase } from '@/lib/supabase/client';
import type { Customer, CustomerRow, CustomerBalance, DashboardSummary, Product, ReportData, Txn, TxnItem } from '@/lib/types';
import { classifyError } from '@/lib/errors';

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw classifyError(res.error);
  return res.data as T;
}

const CACHE_KEY = 'nk_customers_cache';
export interface CustomerCache { at: string; rows: Pick<CustomerRow, 'id' | 'name' | 'phone' | 'outstanding' | 'last_txn_at' | 'customer_no' | 'is_active'>[] }

export async function fetchCustomers(opts: { includeInactive?: boolean } = {}): Promise<CustomerRow[]> {
  const sb = getSupabase();
  const [cs, bs] = await Promise.all([
    sb.from('customers').select('*').order('name').limit(5000),
    sb.from('customer_balances').select('customer_id, outstanding, last_txn_at').limit(5000),
  ]);
  const customers = check<Customer[]>(cs as never);
  const balances = new Map(check<Pick<CustomerBalance, 'customer_id' | 'outstanding' | 'last_txn_at'>[]>(bs as never).map((b) => [b.customer_id, b]));
  const rows = customers
    .map((c) => ({ ...c, outstanding: Number(balances.get(c.id)?.outstanding ?? 0), last_txn_at: balances.get(c.id)?.last_txn_at ?? null }));
  try {
    const cache: CustomerCache = { at: new Date().toISOString(), rows: rows.filter((r) => r.is_active).map(({ id, name, phone, outstanding, last_txn_at, customer_no, is_active }) => ({ id, name, phone, outstanding, last_txn_at, customer_no, is_active })) };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full/blocked: ignore */ }
  return opts.includeInactive ? rows : rows.filter((r) => r.is_active);
}
export function readCustomerCache(): CustomerCache | null {
  try { const raw = localStorage.getItem(CACHE_KEY); return raw ? (JSON.parse(raw) as CustomerCache) : null; } catch { return null; }
}

export async function fetchCustomer(id: string) {
  const sb = getSupabase();
  const [c, b] = await Promise.all([
    sb.from('customers').select('*').eq('id', id).single(),
    sb.from('customer_balances').select('*').eq('customer_id', id).single(),
  ]);
  return { customer: check<Customer>(c as never), balance: check<CustomerBalance>(b as never) };
}

export async function fetchTransactions(customerId: string, opts: { fromISO?: string; toISO?: string; limit?: number; offset?: number } = {}) {
  let q = getSupabase().from('v_transactions').select('*').eq('customer_id', customerId).order('occurred_at', { ascending: false }).order('created_at', { ascending: false });
  if (opts.fromISO) q = q.gte('occurred_at', opts.fromISO);
  if (opts.toISO) q = q.lte('occurred_at', opts.toISO);
  const limit = opts.limit ?? 50, offset = opts.offset ?? 0;
  return check<Txn[]>((await q.range(offset, offset + limit - 1)) as never);
}

export async function fetchItems(transactionIds: string[]): Promise<Record<string, TxnItem[]>> {
  if (!transactionIds.length) return {};
  const rows = check<TxnItem[]>((await getSupabase().from('transaction_items').select('*').in('transaction_id', transactionIds)) as never);
  return rows.reduce<Record<string, TxnItem[]>>((acc, r) => { (acc[r.transaction_id] ??= []).push(r); return acc; }, {});
}

export async function fetchDashboard() { return check<DashboardSummary>((await getSupabase().rpc('dashboard_summary')) as never); }
export async function fetchReport(from: string, to: string) { return check<ReportData>((await getSupabase().rpc('report_range', { p_from: from, p_to: to })) as never); }
export async function fetchProducts() { return check<Product[]>((await getSupabase().from('products').select('*').order('name')) as never); }

export async function fetchSettings() {
  const sb = getSupabase();
  const [s, shop, user] = await Promise.all([
    sb.from('app_settings').select('*').maybeSingle(),
    sb.from('shops').select('id, name').maybeSingle(),
    sb.auth.getUser(),
  ]);
  return { settings: check<{ language: 'ta' | 'en'; allow_advance: boolean } | null>(s as never), shop: check<{ id: string; name: string } | null>(shop as never), email: user.data.user?.email ?? '' };
}

/** pages through a table (RLS limits it to this shop) */
export async function fetchAll<T>(table: string, order: string): Promise<T[]> {
  const sb = getSupabase(); const out: T[] = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const rows = check<T[]>((await sb.from(table).select('*').order(order, { ascending: true }).range(from, from + size - 1)) as never);
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

let shopIdCache: string | null = null;
export async function getShopId(): Promise<string> {
  if (shopIdCache) return shopIdCache;
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw classifyError({ message: 'not authenticated' });
  const res = await sb.from('profiles').select('shop_id').eq('id', user.id).single();
  shopIdCache = check<{ shop_id: string }>(res as never).shop_id;
  return shopIdCache;
}
