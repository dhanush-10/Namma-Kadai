'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, WifiOff } from 'lucide-react';
import { Badge, ErrorBox, Skeleton } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { fetchCustomers, readCustomerCache } from '@/lib/data';
import { formatINR } from '@/lib/money';
import { classifyError } from '@/lib/errors';
import type { CustomerRow } from '@/lib/types';

export type PickedCustomer = Pick<CustomerRow, 'id' | 'name' | 'phone' | 'outstanding'>;

export function matchCustomer(c: { name: string; phone: string | null }, q: string): boolean {
  const s = q.trim().toLowerCase(); if (!s) return true;
  if (c.name.toLowerCase().includes(s)) return true;
  const digits = s.replace(/\D/g, '');
  return digits.length > 0 && (c.phone ?? '').replace(/\D/g, '').includes(digits);
}

export function CustomerPicker({ onPick, autoFocus = true }: { onPick: (c: PickedCustomer) => void; autoFocus?: boolean }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<PickedCustomer[] | null>(null);
  const [stale, setStale] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const load = async () => {
    setErr(null);
    try { setRows(await fetchCustomers()); setStale(false); }
    catch (e) {
      const cache = readCustomerCache();
      if (cache) { setRows(cache.rows as PickedCustomer[]); setStale(true); } else setErr(t(classifyError(e).code));
    }
  };
  useEffect(() => { load();   }, []);
  useEffect(() => { if (autoFocus && rows) input.current?.focus(); }, [rows, autoFocus]);

  const shown = useMemo(() => (rows ?? []).filter((c) => matchCustomer(c, q)).slice(0, 30), [rows, q]);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-brand-600" aria-hidden />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchCustomers')} inputMode="search" autoComplete="off"
          className="min-h-[60px] w-full rounded-2xl border-2 border-brand-100 bg-white pl-13 pr-4 text-lg placeholder:text-ink/35 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-200/60" style={{ paddingLeft: '3.25rem' }} />
      </div>
      {stale && <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-700"><WifiOff className="h-4 w-4 shrink-0" />{t('customerListOld')}</p>}
      {err && <ErrorBox message={err} onRetry={load} />}
      {!rows && !err && <div className="space-y-2"><Skeleton className="h-[72px]" /><Skeleton className="h-[72px]" /><Skeleton className="h-[72px]" /></div>}
      {rows && shown.length === 0 && (
        <Link href={`/customers/new${q.trim() && !/^\d+$/.test(q.trim()) ? `?name=${encodeURIComponent(q.trim())}` : ''}`} className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-brand-100 px-4 font-semibold text-brand-800">
          <UserPlus className="h-6 w-6" /><span>{rows.length ? t('noMatchHint') : t('noCustomersHint')}</span>
        </Link>
      )}
      <ul className="space-y-2">
        {shown.map((c) => (
          <li key={c.id}>
            <button onClick={() => onPick(c)} className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl bg-white px-4 text-left shadow-soft ring-1 ring-brand-900/5 transition active:scale-[.99] hover:ring-brand-300">
              <Avatar name={c.name} />
              <span className="min-w-0 flex-1"><span className="block truncate text-lg font-bold">{c.name}</span>
                {c.phone && <span className="block text-base text-ink/55">{c.phone}</span>}</span>
              {c.outstanding > 0 ? <Badge tone="amber">{formatINR(c.outstanding)}</Badge> : <Badge tone="green">{t('cleared')}</Badge>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initial = Array.from(name.trim())[0] ?? '?';
  return <span className={`grid shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-800 ${size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-12 w-12 text-xl'}`} aria-hidden>{initial.toUpperCase()}</span>;
}
