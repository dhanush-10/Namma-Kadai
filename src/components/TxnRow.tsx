'use client';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { formatINR } from '@/lib/money';
import { formatDateTime, formatTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { TxnType } from '@/lib/types';

export interface TxnLike { id: string; type: TxnType; amount: number; description: string | null; occurred_at: string; is_reversed: boolean; payment_method?: string | null; customer_id?: string; customer_name?: string; reverses_transaction_id?: string | null }

export function TxnRow({ txn, showCustomer = false, showDate = true, onClick }: { txn: TxnLike; showCustomer?: boolean; showDate?: boolean; onClick?: () => void }) {
  const { t, lang } = useI18n();
  const isReversal = !!txn.reverses_transaction_id;
  const isPay = txn.type === 'PAYMENT';
  const label = isReversal ? t('reversal') : txn.type === 'PURCHASE' ? t('purchase') : isPay ? t('payment') : t('adjustment');
  const Icon = isPay ? ArrowDownLeft : txn.type === 'ADJUSTMENT' ? Pencil : ArrowUpRight;
  const tone = isPay ? 'bg-brand-100 text-brand-700' : txn.type === 'ADJUSTMENT' ? 'bg-ink/5 text-ink/60' : 'bg-amber-100 text-amber-700';
  const amt = Number(txn.amount);
  const body = (
    <>
      <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-full', tone)}><Icon className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1 text-left">
        <span className={cn('block truncate text-lg font-bold', txn.is_reversed && 'text-ink/40 line-through')}>
          {showCustomer && txn.customer_name ? txn.customer_name : label}
        </span>
        <span className="block truncate text-sm text-ink/55">
          {showCustomer && `${label} · `}{showDate ? formatDateTime(txn.occurred_at, lang) : formatTime(txn.occurred_at, lang)}
          {txn.payment_method ? ` · ${txn.payment_method === 'CASH' ? t('cash') : txn.payment_method === 'UPI' ? t('upi') : t('other')}` : ''}
          {txn.description ? ` · ${txn.description}` : ''}
        </span>
        {txn.is_reversed && <Badge tone="gray">{t('reversed')}</Badge>}
      </span>
      <span className={cn('text-xl font-extrabold tabular-nums', txn.is_reversed ? 'text-ink/35 line-through' : isPay ? 'text-brand-700' : txn.type === 'ADJUSTMENT' ? (amt < 0 ? 'text-brand-700' : 'text-ink') : 'text-ink')}>
        {isPay ? '−' : amt < 0 ? '−' : '+'}{formatINR(Math.abs(amt))}
      </span>
    </>
  );
  const cls = 'flex min-h-[72px] w-full items-center gap-3 py-2';
  if (onClick) return <button onClick={onClick} className={cls}>{body}</button>;
  if (showCustomer && txn.customer_id) return <Link href={`/customers/${txn.customer_id}`} className={cls}>{body}</Link>;
  return <div className={cls}>{body}</div>;
}
