'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { Avatar, matchCustomer } from '@/components/CustomerPicker';
import { Badge, Button, EmptyState, ErrorBox, Skeleton } from '@/components/ui';
import { useAsync } from '@/lib/hooks/useAsync';
import { useErrText } from '@/lib/hooks/useErrText';
import { useI18n } from '@/lib/i18n/provider';
import { fetchCustomers } from '@/lib/data';
import { formatINR } from '@/lib/money';
import { formatDateShort } from '@/lib/dates';

export default function CustomersPage() {
  const { t, lang } = useI18n(); const errText = useErrText();
  const [q, setQ] = useState(''); const [hidden, setHidden] = useState(false);
  const { data, error, loading, reload } = useAsync(() => fetchCustomers({ includeInactive: hidden }), [hidden]);
  const rows = useMemo(() => (data ?? []).filter((c) => matchCustomer(c, q)), [data, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black">{t('customers')}</h1>
        <Link href="/customers/new"><Button className="min-h-[52px]"><Plus className="h-5 w-5" />{t('addCustomer')}</Button></Link>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-brand-600" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchCustomers')} inputMode="search" autoComplete="off" style={{ paddingLeft: '3.25rem' }}
          className="min-h-[60px] w-full rounded-2xl border-2 border-brand-100 bg-white pr-4 text-lg focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-200/60" />
      </div>
      <label className="flex min-h-[44px] items-center gap-3 text-base font-medium text-ink/70"><input type="checkbox" className="h-6 w-6 accent-brand-700" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />{t('showInactive')}</label>
      {error ? <ErrorBox message={errText(error)} onRetry={reload} /> : loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[84px]" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users className="h-10 w-10" />} title={data?.length ? t('noMatch') : t('noCustomers')} hint={data?.length ? t('noMatchHint') : t('noCustomersHint')}
          action={<Link href={`/customers/new${q.trim() && !/^\d+$/.test(q.trim()) ? `?name=${encodeURIComponent(q.trim())}` : ''}`}><Button><Plus className="h-5 w-5" />{t('addCustomer')}</Button></Link>} />
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/customers/${c.id}`} className={`flex min-h-[84px] items-center gap-3 rounded-2xl bg-white px-4 shadow-soft ring-1 ring-brand-900/5 transition active:scale-[.99] ${c.is_active ? '' : 'opacity-60'}`}>
                <Avatar name={c.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold">{c.name}</span>
                  <span className="block truncate text-sm text-ink/55">{[c.phone, c.last_txn_at ? `${t('lastTransaction')}: ${formatDateShort(c.last_txn_at, lang)}` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="text-right">
                  <span className={`block text-xl font-extrabold tabular-nums ${c.outstanding > 0 ? 'text-amber-700' : c.outstanding < 0 ? 'text-brand-700' : 'text-ink/40'}`}>{formatINR(Math.abs(c.outstanding))}</span>
                  <Badge tone={c.outstanding > 0 ? 'amber' : c.outstanding < 0 ? 'green' : 'gray'}>{c.outstanding > 0 ? t('owes') : c.outstanding < 0 ? t('advance') : t('cleared')}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
