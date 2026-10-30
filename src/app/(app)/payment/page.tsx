'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Avatar, CustomerPicker, type PickedCustomer } from '@/components/CustomerPicker';
import { SuccessPanel } from '@/components/SuccessOverlay';
import { MoneyCounter } from '@/components/Counter';
import { AmountInput, Button, Card, ErrorBox, Field, Input, Segmented } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { useErrText } from '@/lib/hooks/useErrText';
import { useClientId } from '@/lib/hooks/useClientId';
import { useSync } from '@/lib/offline/SyncProvider';
import { fetchCustomer, fetchSettings, readCustomerCache } from '@/lib/data';
import { formatINR, formatPaise, parseAmount, toDecimalString, toPaise } from '@/lib/money';
import type { PaymentPayload } from '@/lib/ledger';
import type { PayMethod } from '@/lib/types';

function PaymentInner() {
  const { t } = useI18n(); const errText = useErrText(); const sp = useSearchParams(); const { save } = useSync(); const { idFor, reset } = useClientId();
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [amount, setAmount] = useState(''); const [method, setMethod] = useState<PayMethod>('CASH'); const [note, setNote] = useState('');
  const [allowAdvance, setAllowAdvance] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | { queued: boolean; outstanding?: number; amount: string }>(null);

  useEffect(() => { fetchSettings().then((s) => setAllowAdvance(!!s.settings?.allow_advance)).catch(() => undefined); }, []);
  useEffect(() => {
    const id = sp.get('customer'); if (!id) return;
    fetchCustomer(id).then(({ customer: c, balance: b }) => setCustomer({ id: c.id, name: c.name, phone: c.phone, outstanding: Number(b.outstanding) }))
      .catch(() => { const hit = readCustomerCache()?.rows.find((r) => r.id === id); if (hit) setCustomer(hit); });
  }, [sp]);
  // always show the freshest balance for the chosen customer
  const pickedId = customer?.id;
  useEffect(() => { if (!pickedId) return; fetchCustomer(pickedId).then(({ balance }) => setCustomer((c) => (c && c.id === pickedId ? { ...c, outstanding: Number(balance.outstanding) } : c))).catch(() => undefined); }, [pickedId]);

  const outP = toPaise(customer?.outstanding); const payP = parseAmount(amount) ?? 0;
  const tooMuch = !allowAdvance && payP > Math.max(outP, 0);
  const remaining = outP - payP;
  const canSave = !!customer && payP > 0 && !tooMuch;

  async function submit() {
    if (!customer || busy) return;
    if (payP <= 0) { setErr(t('enterAmount')); return; }
    if (tooMuch) { setErr(t('PAYMENT_EXCEEDS_OUTSTANDING')); return; }
    setBusy(true); setErr(null);
    const payload: PaymentPayload = {
      customer_id: customer.id, amount: toDecimalString(payP), method, note: note.trim() || null,
      client_txn_id: idFor(JSON.stringify([customer.id, payP, method, note.trim()])), occurred_at: new Date().toISOString(),
    };
    try {
      const r = await save('payment', payload, { customerName: customer.name, amount: payload.amount });
      setDone(r.status === 'saved' ? { queued: false, outstanding: r.result.outstanding, amount: payload.amount } : { queued: true, amount: payload.amount });
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  function again() { reset(); setAmount(''); setNote(''); setMethod('CASH'); setCustomer(null); setDone(null); setErr(null); }

  if (done && customer) return (
    <Card><SuccessPanel queued={done.queued} title={done.queued ? t('pendingSync') : t('paymentSaved')}
      actions={<><Button big onClick={again}>{t('addMore')}</Button><Link href={`/customers/${customer.id}`}><Button big variant="outline" className="w-full">{t('goToCustomer')}</Button></Link></>}>
      <p className="text-xl font-bold">{customer.name} · {formatINR(done.amount)}</p>
      {done.queued ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-base text-amber-700">{t('savedOfflineBody')}</p>
        : <p className="mt-2 text-base text-ink/60">{t('remaining')}: <b className="text-2xl text-brand-700"><MoneyCounter paise={Math.abs(toPaise(done.outstanding))} /></b></p>}
    </SuccessPanel></Card>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-black">{t('receivePayment')}</h1>
      {!customer ? (
        <div className="space-y-3"><p className="text-lg font-semibold text-ink/70">{t('chooseCustomer')}</p><CustomerPicker onPick={setCustomer} /></div>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex items-center gap-3"><Avatar name={customer.name} /><p className="min-w-0 flex-1 truncate text-xl font-bold">{customer.name}</p>
              <Button variant="soft" className="min-h-[48px] px-4" onClick={() => setCustomer(null)}>{t('changeCustomer')}</Button></div>
            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-base font-semibold text-ink/60">{t('previousOutstanding')}</p><p className="text-4xl font-black tabular-nums text-amber-700">{formatPaise(outP)}</p></div>
          </Card>
          {outP <= 0 && !allowAdvance ? <p className="rounded-2xl bg-brand-100 p-4 text-lg font-semibold text-brand-900">{t('nothingOwed')}</p> : (
            <>
              <Field label={t('paymentAmount')} htmlFor="pa" error={tooMuch ? t('PAYMENT_EXCEEDS_OUTSTANDING') : null}>
                <AmountInput id="pa" value={amount} onValueChange={setAmount} autoFocus aria-invalid={tooMuch} />
              </Field>
              {outP > 0 && <Button variant="soft" className="w-full" onClick={() => setAmount(toDecimalString(outP).replace(/\.00$/, ''))}>{t('fullAmount')} · {formatPaise(outP)}</Button>}
              <Field label={t('paymentMethod')}>
                <Segmented value={method} onChange={setMethod} options={[{ value: 'CASH', label: t('cash') }, { value: 'UPI', label: t('upi') }, { value: 'OTHER', label: t('other') }]} />
              </Field>
              <Field label={t('note')} htmlFor="pn" optional><Input id="pn" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
              {payP > 0 && !tooMuch && (
                <div className="flex items-center justify-between rounded-3xl bg-brand-800 px-5 py-4 text-white">
                  <span className="text-lg font-semibold">{remaining < 0 ? t('advance') : t('remaining')}</span><span className="text-3xl font-extrabold tabular-nums">{formatPaise(Math.abs(remaining))}</span></div>
              )}
              {err && <ErrorBox message={err} />}
              <Button big className="w-full" loading={busy} disabled={!canSave} onClick={submit}>{t('savePayment')}{payP > 0 ? ` · ${formatPaise(payP)}` : ''}</Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
export default function PaymentPage() { return <Suspense><PaymentInner /></Suspense>; }
