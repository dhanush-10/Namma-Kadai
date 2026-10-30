'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { Calculator, Plus, Receipt, Users, Wallet, Banknote, TrendingUp, HandCoins } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorBox, Skeleton } from '@/components/ui';
import { CountUp, MoneyCounter } from '@/components/Counter';
import { TxnRow } from '@/components/TxnRow';
import { Avatar } from '@/components/CustomerPicker';
import { useAsync } from '@/lib/hooks/useAsync';
import { useErrText } from '@/lib/hooks/useErrText';
import { useI18n } from '@/lib/i18n/provider';
import { useSync } from '@/lib/offline/SyncProvider';
import { fetchDashboard } from '@/lib/data';
import { toPaise, formatINR } from '@/lib/money';
import { formatDateShort, weekdayShort } from '@/lib/dates';

export default function DashboardPage() {
  const { t, lang } = useI18n(); const errText = useErrText(); const { onSynced } = useSync();
  const { data, error, loading, reload } = useAsync(fetchDashboard, []);
  useEffect(() => onSynced(reload), [onSynced, reload]);

  const actions = [
    { href: '/purchase', label: t('addPurchase'), icon: Plus, cls: 'bg-brand-700 text-white' },
    { href: '/payment', label: t('receivePayment'), icon: Wallet, cls: 'bg-brand-200 text-brand-900' },
    { href: '/customers', label: t('customers'), icon: Users, cls: 'bg-white text-brand-900 ring-1 ring-brand-900/10' },
    { href: '/calculator', label: t('calculator'), icon: Calculator, cls: 'bg-white text-brand-900 ring-1 ring-brand-900/10' },
  ];
  const week = data?.week ?? []; const maxW = Math.max(1, ...week.map((w) => toPaise(w.payments)));

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className={`flex min-h-[112px] flex-col justify-between rounded-3xl p-4 shadow-soft transition active:scale-[.98] ${a.cls}`}>
            <a.icon className="h-8 w-8" /><span className="text-xl font-extrabold leading-tight">{a.label}</span>
          </Link>
        ))}
      </section>

      {error ? <ErrorBox message={errText(error)} onRetry={reload} /> : (
        <section className="space-y-3">
          <Card className="bg-gradient-to-br from-brand-800 to-brand-950 text-white ring-0">
            <p className="flex items-center gap-2 text-base font-semibold text-brand-200"><TrendingUp className="h-5 w-5" />{t('todaysSales')}</p>
            {loading || !data ? <Skeleton className="mt-2 h-12 w-48 bg-white/10" /> : <p className="mt-1 text-5xl font-black tracking-tight tabular-nums"><MoneyCounter paise={toPaise(data.today_sales)} /></p>}
            <p className="mt-1 text-sm text-brand-200">{t('salesNote')}</p>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<HandCoins className="h-5 w-5" />} label={t('creditGiven')} loading={loading} value={data && <MoneyCounter paise={toPaise(data.today_credit)} />} tone="text-amber-700" />
            <Stat icon={<Banknote className="h-5 w-5" />} label={t('paymentsReceived')} loading={loading} value={data && <MoneyCounter paise={toPaise(data.today_payments)} />} tone="text-brand-700" />
            <Stat icon={<Receipt className="h-5 w-5" />} label={t('totalOutstanding')} loading={loading} value={data && <MoneyCounter paise={toPaise(data.total_outstanding)} />} tone="text-danger-600" />
            <Stat icon={<Users className="h-5 w-5" />} label={t('customerCount')} loading={loading} value={data && <CountUp value={data.customer_count} />} tone="text-ink" />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xl font-extrabold">{t('pendingBalances')}</h2>
        <Card className="p-2">
          {loading ? <Skeleton className="h-24" /> : !data?.pending_customers.length ? <EmptyState icon={<Users className="h-9 w-9" />} title={t('noPending')} hint={t('noPendingHint')} /> : (
            <ul className="divide-y divide-brand-100">
              {data.pending_customers.map((c) => (
                <li key={c.id}><Link href={`/customers/${c.id}`} className="flex min-h-[72px] items-center gap-3 px-2">
                  <Avatar name={c.name} /><span className="min-w-0 flex-1"><span className="block truncate text-lg font-bold">{c.name}</span>
                    {c.last_txn_at && <span className="text-sm text-ink/55">{formatDateShort(c.last_txn_at, lang)}</span>}</span>
                  <Badge tone="amber">{formatINR(c.outstanding)}</Badge></Link></li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between"><h2 className="text-xl font-extrabold">{t('weeklyCollection')}</h2>
          <span className="text-sm text-ink/55">{data ? `${data.today_txn_count} ${t('entriesToday')}` : ''}</span></div>
        <Card>
          <div className="flex h-36 items-end gap-2" role="img" aria-label={t('weeklyCollection')}>
            {week.map((w) => { const p = toPaise(w.payments); return (
              <div key={w.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold tabular-nums text-ink/60">{p ? formatINR(w.payments) : ''}</span>
                <div className="w-full rounded-t-xl bg-gradient-to-t from-brand-600 to-brand-300 transition-[height] duration-700" style={{ height: `${Math.max(p ? 6 : 2, (p / maxW) * 100)}px`, opacity: p ? 1 : 0.25 }} />
                <span className="text-xs font-semibold text-ink/60">{weekdayShort(w.day, lang)}</span>
              </div>); })}
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between"><h2 className="text-xl font-extrabold">{t('recentTransactions')}</h2>
          <Link href="/customers" className="min-h-[44px] py-2 font-semibold text-brand-700">{t('viewAll')}</Link></div>
        <Card className="px-4 py-2">
          {loading ? <Skeleton className="h-28" /> : !data?.recent.length ? <EmptyState icon={<Receipt className="h-9 w-9" />} title={t('noTransactionsYet')} hint={t('noTransactionsHint')} /> : (
            <ul className="divide-y divide-brand-100">{data.recent.map((r) => <li key={r.id}><TxnRow txn={{ ...r, reverses_transaction_id: null }} showCustomer /></li>)}</ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, tone, loading }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: string; loading: boolean }) {
  return (
    <Card className="p-4"><p className="flex items-center gap-1.5 text-sm font-semibold text-ink/60">{icon}{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className={`mt-1 text-2xl font-extrabold tabular-nums ${tone}`}>{value}</p>}</Card>
  );
}
