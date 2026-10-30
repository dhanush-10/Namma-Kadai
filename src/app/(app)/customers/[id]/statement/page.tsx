'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button, ErrorBox, Field, Input, Skeleton } from '@/components/ui';
import { useAsync } from '@/lib/hooks/useAsync';
import { useErrText } from '@/lib/hooks/useErrText';
import { useI18n } from '@/lib/i18n/provider';
import { fetchCustomer, fetchAll } from '@/lib/data';
import { formatDate, startOfMonth, todayIST, TZ } from '@/lib/dates';
import { formatPaise, toPaise } from '@/lib/money';
import type { Txn } from '@/lib/types';

const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
const signed = (t: Txn) => (t.type === 'PAYMENT' ? -toPaise(t.amount) : toPaise(t.amount));

/** Notebook-style statement. "Print / save as PDF" uses the phone's print dialog, which handles Tamil text correctly. */
export default function StatementPage() {
  const { id } = useParams<{ id: string }>(); const { t, lang } = useI18n(); const errText = useErrText();
  const [from, setFrom] = useState(startOfMonth(todayIST())); const [to, setTo] = useState(todayIST());
  const { data, error, reload } = useAsync(async () => {
    const [head, all] = await Promise.all([fetchCustomer(id), fetchAll<Txn>('transactions', 'occurred_at')]);
    return { ...head, txns: all.filter((x) => x.customer_id === id) };
  }, [id]);

  const view = useMemo(() => {
    if (!data) return null;
    const sorted = [...data.txns].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.created_at.localeCompare(b.created_at));
    let run = toPaise(data.customer.opening_balance); let brought = run; const rows: { t: Txn; bal: number }[] = [];
    for (const x of sorted) {
      run += signed(x); const d = dayOf(x.occurred_at);
      if (d < from) brought = run; else if (d <= to) rows.push({ t: x, bal: run });
    }
    const inRange = rows.map((r) => r.t);
    return { rows, brought, purchases: inRange.filter((x) => x.type === 'PURCHASE').reduce((a, x) => a + toPaise(x.amount), 0),
      payments: inRange.filter((x) => x.type === 'PAYMENT').reduce((a, x) => a + toPaise(x.amount), 0), closing: rows.length ? rows[rows.length - 1].bal : brought };
  }, [data, from, to]);

  if (error) return <ErrorBox message={errText(error)} onRetry={reload} />;
  if (!data || !view) return <Skeleton className="h-96" />;
  const label = (x: Txn) => (x.reverses_transaction_id ? t('reversal') : x.type === 'PURCHASE' ? t('purchase') : x.type === 'PAYMENT' ? t('payment') : t('adjustment'));
  return (
    <div className="space-y-4">
      <div className="no-print space-y-3">
        <Link href={`/customers/${id}`} className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-brand-700"><ArrowLeft className="h-5 w-5" />{t('back')}</Link>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('from')} htmlFor="sf"><Input id="sf" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
          <Field label={t('to')} htmlFor="st"><Input id="st" type="date" value={to} min={from} max={todayIST()} onChange={(e) => e.target.value && setTo(e.target.value)} /></Field>
        </div>
        <Button big className="w-full" onClick={() => window.print()}><Printer className="h-6 w-6" />{t('printStatement')}</Button>
      </div>
      <article className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-brand-900/5 print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <header className="mb-4 border-b-2 border-brand-700 pb-3">
          <p className="text-sm font-bold text-brand-700">{t('appName')} · {t('statement')}</p>
          <h1 className="text-2xl font-black">{data.customer.name}</h1>
          <p className="text-sm text-ink/60">{[data.customer.phone, data.customer.address].filter(Boolean).join(' · ')}</p>
          <p className="text-sm text-ink/60">{formatDate(from, lang)} – {formatDate(to, lang)}</p>
        </header>
        <table className="w-full text-left text-base">
          <thead><tr className="border-b border-brand-200 text-sm text-ink/60"><th className="py-2 font-semibold">{t('date')}</th><th className="font-semibold">{t('description')}</th><th className="text-right font-semibold">{t('amount')}</th><th className="text-right font-semibold">{t('balance')}</th></tr></thead>
          <tbody>
            <tr className="border-b border-brand-100 text-ink/60"><td className="py-2" colSpan={3}>{t('openingLine')}</td><td className="text-right font-semibold tabular-nums">{formatPaise(view.brought)}</td></tr>
            {view.rows.map(({ t: x, bal }) => (
              <tr key={x.id} className="border-b border-brand-100 align-top">
                <td className="whitespace-nowrap py-2 pr-2">{formatDate(x.occurred_at, lang)}</td>
                <td className="pr-2">{label(x)}{x.description ? ` – ${x.description}` : ''}{x.is_reversed ? ` (${t('reversed')})` : ''}</td>
                <td className={`text-right font-semibold tabular-nums ${x.type === 'PAYMENT' ? 'text-brand-700' : ''}`}>{x.type === 'PAYMENT' ? '−' : toPaise(x.amount) < 0 ? '−' : '+'}{formatPaise(Math.abs(toPaise(x.amount)))}</td>
                <td className="text-right tabular-nums">{formatPaise(bal)}</td>
              </tr>
            ))}
            {!view.rows.length && <tr><td colSpan={4} className="py-6 text-center text-ink/50">{t('noHistory')}</td></tr>}
          </tbody>
        </table>
        <footer className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-brand-50 p-3 text-center">
          <div><p className="text-xs text-ink/60">{t('totalPurchases')}</p><p className="font-extrabold tabular-nums">{formatPaise(view.purchases)}</p></div>
          <div><p className="text-xs text-ink/60">{t('totalPayments')}</p><p className="font-extrabold tabular-nums">{formatPaise(view.payments)}</p></div>
          <div><p className="text-xs text-ink/60">{t('outstanding')}</p><p className="text-xl font-black tabular-nums text-amber-700">{formatPaise(view.closing)}</p></div>
        </footer>
      </article>
    </div>
  );
}
