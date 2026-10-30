'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, FileText, Pencil, Plus, SlidersHorizontal, Wallet } from 'lucide-react';
import { Avatar } from '@/components/CustomerPicker';
import { TxnRow } from '@/components/TxnRow';
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Segmented, Sheet, Skeleton, Textarea } from '@/components/ui';
import { MoneyCounter } from '@/components/Counter';
import { useAsync } from '@/lib/hooks/useAsync';
import { useErrText } from '@/lib/hooks/useErrText';
import { useI18n } from '@/lib/i18n/provider';
import { useSync } from '@/lib/offline/SyncProvider';
import { fetchCustomer, fetchItems, fetchTransactions } from '@/lib/data';
import { formatINR, parseAmount, toDecimalString, toPaise } from '@/lib/money';
import { addDays, dayEndISO, dayStartISO, formatDate, startOfMonth, todayIST } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase/client';
import { classifyError } from '@/lib/errors';
import { newId } from '@/lib/utils';
import type { Txn, TxnItem } from '@/lib/types';

const PAGE = 40;
type Range = 'all' | 'month' | 'custom';

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter();
  const { t, lang } = useI18n(); const errText = useErrText(); const { onSynced } = useSync();
  const [range, setRange] = useState<Range>('all');
  const [from, setFrom] = useState(startOfMonth(todayIST())); const [to, setTo] = useState(todayIST());
  const bounds = range === 'all' ? {} : range === 'month' ? { fromISO: dayStartISO(startOfMonth(todayIST())) } : { fromISO: dayStartISO(from), toISO: dayEndISO(to) };

  const head = useAsync(() => fetchCustomer(id), [id]);
  const [rows, setRows] = useState<Txn[]>([]); const [more, setMore] = useState(false); const [loadingList, setLoadingList] = useState(true); const [listErr, setListErr] = useState<unknown>(null);
  const [items, setItems] = useState<Record<string, TxnItem[]>>({});
  const [open, setOpen] = useState<Txn | null>(null); const [adj, setAdj] = useState(false);

  async function loadList(reset: boolean) {
    setLoadingList(true); setListErr(null);
    try {
      const offset = reset ? 0 : rows.length;
      const r = await fetchTransactions(id, { ...bounds, limit: PAGE, offset });
      const it = await fetchItems(r.filter((x) => x.type === 'PURCHASE').map((x) => x.id));
      setRows(reset ? r : [...rows, ...r]); setItems((p) => ({ ...(reset ? {} : p), ...it })); setMore(r.length === PAGE);
    } catch (e) { setListErr(e); } finally { setLoadingList(false); }
  }
  useEffect(() => { loadList(true);   }, [id, range, from, to]);
  useEffect(() => onSynced(() => { head.reload(); loadList(true); }), [onSynced]); // eslint-disable-line react-hooks/exhaustive-deps

  if (head.error) return <ErrorBox message={errText(head.error)} onRetry={head.reload} />;
  if (!head.data) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  const { customer: c, balance: b } = head.data; const out = toPaise(b.outstanding);

  async function toggleActive() {
    if (c.is_active && !window.confirm(t('hideConfirm'))) return;
    const { error } = await getSupabase().from('customers').update({ is_active: !c.is_active }).eq('id', c.id);
    if (!error) { head.reload(); router.refresh(); }
  }
  const refreshAll = () => { head.reload(); loadList(true); };

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={c.name} size="lg" />
          <div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-black">{c.name}</h1>
            <p className="text-base text-ink/60">{t('customerNo')} {c.customer_no}{c.phone ? ` · ${c.phone}` : ''}</p>
            {!c.is_active && <Badge tone="gray">{t('showInactive')}</Badge>}</div>
          <Link href={`/customers/${c.id}/edit`} aria-label={t('edit')} className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-800"><Pencil className="h-5 w-5" /></Link>
        </div>
        <div className={`rounded-3xl p-5 ${out > 0 ? 'bg-amber-50' : 'bg-brand-50'}`}>
          <p className="text-base font-semibold text-ink/60">{out < 0 ? t('advance') : t('outstanding')}</p>
          <p className={`text-5xl font-black tabular-nums ${out > 0 ? 'text-amber-700' : 'text-brand-700'}`}><MoneyCounter paise={Math.abs(out)} /></p>
        </div>
        {c.address && <p className="text-base text-ink/70">{c.address}</p>}{c.notes && <p className="rounded-xl bg-paper p-3 text-base text-ink/70">{c.notes}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/purchase?customer=${c.id}`}><Button big className="w-full"><Plus className="h-6 w-6" />{t('addPurchase')}</Button></Link>
          <Link href={`/payment?customer=${c.id}`}><Button big variant="soft" className="w-full"><Wallet className="h-6 w-6" />{t('receivePayment')}</Button></Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Mini label={t('totalPurchases')} value={formatINR(b.total_purchases)} />
        <Mini label={t('totalPayments')} value={formatINR(b.total_payments)} />
        <Mini label={t('lastPurchase')} value={b.last_purchase_at ? formatDate(b.last_purchase_at, lang) : '—'} />
        <Mini label={t('lastPayment')} value={b.last_payment_at ? formatDate(b.last_payment_at, lang) : '—'} />
      </div>
      {toPaise(b.opening_balance) !== 0 && <p className="px-1 text-sm text-ink/60">{t('openingLine')}: <b>{formatINR(b.opening_balance)}</b>{toPaise(b.total_adjustments) !== 0 && <> · {t('adjustments')}: <b>{formatINR(b.total_adjustments)}</b></>}</p>}

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">{t('history')}</h2>
        <Segmented<Range> value={range} onChange={setRange} options={[{ value: 'all', label: t('all') }, { value: 'month', label: t('thisMonth') }, { value: 'custom', label: t('custom') }]} />
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('from')} htmlFor="f"><Input id="f" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
            <Field label={t('to')} htmlFor="t"><Input id="t" type="date" value={to} min={from} max={todayIST()} onChange={(e) => e.target.value && setTo(e.target.value)} /></Field>
          </div>
        )}
        {listErr ? <ErrorBox message={errText(listErr)} onRetry={() => loadList(true)} /> : (
          <Card className="px-4 py-2">
            {loadingList && !rows.length ? <Skeleton className="h-32" /> : !rows.length ? <EmptyState icon={<FileText className="h-9 w-9" />} title={t('noHistory')} /> : (
              <ul className="divide-y divide-brand-100">{rows.map((r) => <li key={r.id}><TxnRow txn={r} onClick={() => setOpen(r)} /></li>)}</ul>
            )}
          </Card>
        )}
        {more && <Button variant="outline" className="w-full" loading={loadingList} onClick={() => loadList(false)}>{t('loadMore')}</Button>}
      </section>

      <div className="grid gap-3">
        <Link href={`/customers/${c.id}/statement`}><Button variant="outline" className="w-full"><FileText className="h-5 w-5" />{t('statement')}</Button></Link>
        <Button variant="ghost" className="w-full" onClick={() => setAdj(true)}><SlidersHorizontal className="h-5 w-5" />{t('addAdjustment')}</Button>
        <Button variant="ghost" className="w-full text-ink/60" onClick={toggleActive}>{c.is_active ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}{c.is_active ? t('hideCustomer') : t('unhideCustomer')}</Button>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? (open.type === 'PURCHASE' ? t('purchase') : open.type === 'PAYMENT' ? t('payment') : t('adjustment')) : ''}>
        {open && <TxnDetail txn={open} items={items[open.id] ?? []} onDone={() => { setOpen(null); refreshAll(); }} />}
      </Sheet>
      <Sheet open={adj} onClose={() => setAdj(false)} title={t('addAdjustment')}>
        <AdjustForm customerId={c.id} onDone={() => { setAdj(false); refreshAll(); }} />
      </Sheet>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-sm font-semibold text-ink/55">{label}</p><p className="mt-1 text-xl font-extrabold tabular-nums">{value}</p></Card>;
}

function TxnDetail({ txn, items, onDone }: { txn: Txn; items: TxnItem[]; onDone: () => void }) {
  const { t, lang } = useI18n(); const errText = useErrText();
  const [asking, setAsking] = useState(false); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [cid] = useState(newId);
  const canCancel = !txn.is_reversed && !txn.reverses_transaction_id;
  async function cancel() {
    setBusy(true); setErr(null);
    const { error } = await getSupabase().rpc('reverse_transaction', { p_transaction_id: txn.id, p_reason: reason, p_client_txn_id: cid });
    if (error) { setErr(errText(classifyError(error))); setBusy(false); return; }
    onDone();
  }
  return (
    <div className="space-y-4">
      <p className="text-4xl font-black tabular-nums">{formatINR(Math.abs(txn.amount))}</p>
      <p className="text-base text-ink/60">{formatDate(txn.occurred_at, lang)}</p>
      {txn.description && <p className="rounded-xl bg-white p-3 text-lg">{txn.description}</p>}
      {items.length > 0 && (
        <div className="rounded-2xl bg-white p-3"><p className="mb-1 text-sm font-semibold text-ink/55">{t('items')}</p>
          {items.map((i) => <div key={i.id} className="flex justify-between py-1 text-lg"><span>{i.name} <span className="text-ink/50">{i.quantity} × {formatINR(i.unit_price)}</span></span><b className="tabular-nums">{formatINR(i.line_total)}</b></div>)}</div>
      )}
      {txn.is_reversed && <Badge tone="gray">{t('reversed')}</Badge>}
      {canCancel && (asking ? (
        <div className="space-y-3">
          <p className="text-sm text-ink/60">{t('cancelEntryHint')}</p>
          <Field label={t('reasonLabel')} htmlFor="r" error={err}><Textarea id="r" value={reason} placeholder={t('reasonPlaceholder')} onChange={(e) => setReason(e.target.value)} /></Field>
          <Button variant="danger" className="w-full" loading={busy} disabled={reason.trim().length < 3} onClick={cancel}>{t('cancelEntry')}</Button>
        </div>
      ) : <Button variant="outline" className="w-full text-danger-600" onClick={() => setAsking(true)}>{t('cancelEntry')}</Button>)}
    </div>
  );
}

function AdjustForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const { t } = useI18n(); const errText = useErrText();
  const [dir, setDir] = useState<'up' | 'down'>('up'); const [amt, setAmt] = useState(''); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [cid] = useState(newId);
  const p = parseAmount(amt);
  async function save() {
    if (!p || p <= 0) { setErr(t('INVALID_AMOUNT')); return; }
    setBusy(true); setErr(null);
    const { error } = await getSupabase().rpc('create_adjustment', { p_customer_id: customerId, p_amount: toDecimalString(dir === 'up' ? p : -p), p_reason: reason, p_client_txn_id: cid });
    if (error) { setErr(errText(classifyError(error))); setBusy(false); return; }
    onDone();
  }
  return (
    <div className="space-y-4">
      <p className="text-base text-ink/60">{t('adjustmentHint')}</p>
      <Segmented value={dir} onChange={setDir} options={[{ value: 'up', label: `+ ${t('increase')}` }, { value: 'down', label: `− ${t('decrease')}` }]} />
      <Field label={t('amount')} htmlFor="aa"><Input id="aa" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} placeholder="₹" /></Field>
      <Field label={t('reasonLabel')} htmlFor="ar" error={err}><Textarea id="ar" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <Button className="w-full" big loading={busy} disabled={!p || reason.trim().length < 3} onClick={save}>{t('save')}</Button>
    </div>
  );
}
void addDays;
