'use client';
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Card, ErrorBox, Field, Input, Segmented, Skeleton } from '@/components/ui';
import { MoneyCounter } from '@/components/Counter';
import { useAsync } from '@/lib/hooks/useAsync';
import { useErrText } from '@/lib/hooks/useErrText';
import { useI18n } from '@/lib/i18n/provider';
import { fetchReport } from '@/lib/data';
import { formatDate, startOfMonth, startOfWeek, todayIST } from '@/lib/dates';
import { formatINR, toPaise } from '@/lib/money';
import { downloadText, toCSV } from '@/lib/csv';

type Preset = 'daily' | 'weekly' | 'monthly' | 'custom';
export default function ReportsPage() {
  const { t, lang } = useI18n(); const errText = useErrText();
  const today = todayIST();
  const [preset, setPreset] = useState<Preset>('daily'); const [from, setFrom] = useState(today); const [to, setTo] = useState(today);
  const pick = (p: Preset) => { setPreset(p); if (p === 'daily') { setFrom(today); setTo(today); } if (p === 'weekly') { setFrom(startOfWeek(today)); setTo(today); } if (p === 'monthly') { setFrom(startOfMonth(today)); setTo(today); } };
  const { data, error, loading, reload } = useAsync(() => fetchReport(from, to), [from, to]);
  const rows = useMemo(() => [...(data?.days ?? [])].reverse(), [data]);

  function exportCsv() {
    if (!data) return;
    const head = [t('date'), t('creditPurchases'), t('cashSales'), t('totalSales'), t('paymentsCollected')];
    const body = data.days.map((d) => [d.day, d.credit_purchases, d.cash_sales, (toPaise(d.credit_purchases) + toPaise(d.cash_sales)) / 100, d.payments]);
    body.push(['TOTAL', data.totals.credit_purchases, data.totals.cash_sales, data.total_sales, data.totals.payments]);
    downloadText(`namma-kadai-report-${from}-to-${to}.csv`, toCSV(head, body));
  }
  const cards = data ? [
    { label: t('totalSales'), v: data.total_sales, tone: 'text-ink' }, { label: t('creditPurchases'), v: data.totals.credit_purchases, tone: 'text-amber-700' },
    { label: t('cashSales'), v: data.totals.cash_sales, tone: 'text-ink' }, { label: t('paymentsCollected'), v: data.totals.payments, tone: 'text-brand-700' },
  ] : [];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black">{t('reports')}</h1>
      <Segmented<Preset> value={preset} onChange={pick} options={[{ value: 'daily', label: t('daily') }, { value: 'weekly', label: t('weekly') }, { value: 'monthly', label: t('monthly') }, { value: 'custom', label: t('custom') }]} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('from')} htmlFor="rf"><Input id="rf" type="date" value={from} max={to} onChange={(e) => { if (e.target.value) { setFrom(e.target.value); setPreset('custom'); } }} /></Field>
        <Field label={t('to')} htmlFor="rt"><Input id="rt" type="date" value={to} min={from} max={today} onChange={(e) => { if (e.target.value) { setTo(e.target.value); setPreset('custom'); } }} /></Field>
      </div>
      {error ? <ErrorBox message={errText(error)} onRetry={reload} /> : loading || !data ? <Skeleton className="h-64" /> : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => <Card key={c.label} className="p-4"><p className="text-sm font-semibold text-ink/60">{c.label}</p><p className={`mt-1 text-2xl font-extrabold tabular-nums ${c.tone}`}><MoneyCounter paise={toPaise(c.v)} /></p></Card>)}
            <Card className="col-span-2 flex items-center justify-between bg-amber-50 p-4 ring-amber-100"><div><p className="text-sm font-semibold text-ink/60">{t('pendingCredit')}</p>
              <p className="text-3xl font-black tabular-nums text-amber-700">{formatINR(data.outstanding_now)}</p></div><p className="text-right text-sm text-ink/60">{data.customers_pending} {t('customersPending')}</p></Card>
          </div>
          <p className="rounded-2xl bg-brand-50 p-3 text-sm text-ink/70">{t('collectionsNote')}</p>
          {rows.length > 1 && (
            <Card className="overflow-x-auto p-0"><table className="w-full min-w-[420px] text-left text-base">
              <thead><tr className="border-b border-brand-100 text-sm text-ink/60"><th className="p-3 font-semibold">{t('date')}</th><th className="font-semibold">{t('creditPurchases')}</th><th className="font-semibold">{t('cashSales')}</th><th className="pr-3 text-right font-semibold">{t('paymentsCollected')}</th></tr></thead>
              <tbody>{rows.map((d) => <tr key={d.day} className="border-b border-brand-50"><td className="p-3">{formatDate(d.day, lang)}</td><td className="tabular-nums">{formatINR(d.credit_purchases)}</td><td className="tabular-nums">{formatINR(d.cash_sales)}</td><td className="pr-3 text-right tabular-nums text-brand-700">{formatINR(d.payments)}</td></tr>)}</tbody></table></Card>
          )}
          <Button variant="outline" className="w-full" onClick={exportCsv}><Download className="h-5 w-5" />{t('exportCsv')}</Button>
        </>
      )}
    </div>
  );
}
