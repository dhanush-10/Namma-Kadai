'use client';
import { useState } from 'react';
import Link from 'next/link';
import { SuccessPanel } from '@/components/SuccessOverlay';
import { AmountInput, Button, Card, ErrorBox, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { useErrText } from '@/lib/hooks/useErrText';
import { useClientId } from '@/lib/hooks/useClientId';
import { useSync } from '@/lib/offline/SyncProvider';
import { formatINR, formatPaise, parseAmount, toDecimalString } from '@/lib/money';
import type { CashSalePayload } from '@/lib/ledger';

export default function CashSale() {
  const { t } = useI18n(); const errText = useErrText(); const { save } = useSync(); const { idFor, reset } = useClientId();
  const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | { queued: boolean; amount: string }>(null);
  const p = parseAmount(amount) ?? 0;
  async function submit() {
    if (p <= 0 || busy) return; setBusy(true); setErr(null);
    const payload: CashSalePayload = { amount: toDecimalString(p), note: note.trim() || null, client_txn_id: idFor(JSON.stringify([p, note.trim()])), occurred_at: new Date().toISOString() };
    try { const r = await save('cash_sale', payload, { customerName: null, amount: payload.amount }); setDone({ queued: r.status === 'queued', amount: payload.amount }); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  if (done) return (
    <Card><SuccessPanel queued={done.queued} title={done.queued ? t('pendingSync') : t('cashSaleSaved')}
      actions={<><Button big onClick={() => { reset(); setAmount(''); setNote(''); setDone(null); }}>{t('addMore')}</Button><Link href="/dashboard"><Button big variant="outline" className="w-full">{t('navHome')}</Button></Link></>}>
      <p className="text-2xl font-bold">{formatINR(done.amount)}</p>
      {done.queued && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-base text-amber-700">{t('savedOfflineBody')}</p>}
    </SuccessPanel></Card>
  );
  return (
    <div className="space-y-5">
      <div><h1 className="text-3xl font-black">{t('cashSaleTitle')}</h1><p className="text-base text-ink/60">{t('cashSaleHint')}</p></div>
      <Field label={t('amount')} htmlFor="ca"><AmountInput id="ca" value={amount} onValueChange={setAmount} autoFocus /></Field>
      <Field label={t('description')} htmlFor="cn" optional><Input id="cn" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
      {err && <ErrorBox message={err} />}
      <Button big className="w-full" loading={busy} disabled={p <= 0} onClick={submit}>{t('saveCashSale')}{p > 0 ? ` · ${formatPaise(p)}` : ''}</Button>
    </div>
  );
}
