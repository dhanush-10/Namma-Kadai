'use client';
import { CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { useSync } from '@/lib/offline/SyncProvider';
import { formatDateTime } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import type { DictKey } from '@/lib/i18n/en';

export default function SyncPage() {
  const { t, lang } = useI18n(); const { items, online, syncing, syncNow, retryItem, discardItem } = useSync();
  const kind = (k: string) => (k === 'purchase' ? t('purchase') : k === 'payment' ? t('payment') : t('cashSaleTitle'));
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black">{t('syncStatus')}</h1>
      <Badge tone={online ? 'green' : 'amber'}>{online ? t('online') : t('offline')}</Badge>
      {items.length === 0 ? <Card><EmptyState icon={<CheckCircle2 className="h-10 w-10" />} title={t('syncedOk')} hint={t('nothingPending')} /></Card> : (
        <>
          <Button big className="w-full" loading={syncing} disabled={!online} onClick={syncNow}><RefreshCw className="h-6 w-6" />{syncing ? t('syncing') : t('syncNow')}</Button>
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id}><Card className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-lg font-bold">{i.customerName ?? kind(i.kind)} · {formatINR(i.amount)}</p>
                    <p className="text-sm text-ink/60">{kind(i.kind)} · {formatDateTime(i.createdAt, lang)}</p></div>
                  <Badge tone={i.status === 'failed' ? 'red' : 'amber'}>{i.status === 'failed' ? t('failedEntry') : t('pendingSync')}</Badge>
                </div>
                {i.error && <p className="rounded-xl bg-danger-50 p-3 text-sm font-medium text-danger-700">{t((i.error in { x: 1 } ? 'UNKNOWN' : i.error) as DictKey)}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="soft" disabled={!online || syncing} onClick={() => retryItem(i.id)}><RefreshCw className="h-5 w-5" />{t('retry')}</Button>
                  <Button variant="outline" className="text-danger-600" onClick={() => { if (window.confirm(t('discardConfirm'))) discardItem(i.id); }}><Trash2 className="h-5 w-5" />{t('discard')}</Button>
                </div>
              </Card></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
