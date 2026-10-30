'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { CustomerPicker, Avatar, type PickedCustomer } from '@/components/CustomerPicker';
import { BILL_DRAFT_KEY } from '@/components/Calculator';
import { SuccessPanel } from '@/components/SuccessOverlay';
import { AmountInput, Badge, Button, Card, ErrorBox, Field, Input, Segmented, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { useErrText } from '@/lib/hooks/useErrText';
import { useClientId } from '@/lib/hooks/useClientId';
import { useSync } from '@/lib/offline/SyncProvider';
import { fetchCustomer, fetchProducts, readCustomerCache } from '@/lib/data';
import { formatINR, formatPaise, lineTotal, parseAmount, sumPaise, toDecimalString } from '@/lib/money';
import type { PurchasePayload } from '@/lib/ledger';
import type { Product } from '@/lib/types';
import { MoneyCounter } from '@/components/Counter';
import { toPaise } from '@/lib/money';

interface Line { name: string; qty: string; price: string }
const blank = (): Line => ({ name: '', qty: '1', price: '' });

function PurchaseInner() {
  const { t } = useI18n(); const errText = useErrText(); const sp = useSearchParams(); const { save } = useSync(); const { idFor, reset } = useClientId();
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [mode, setMode] = useState<'quick' | 'items'>(sp.get('mode') === 'items' ? 'items' : 'quick');
  const [amount, setAmount] = useState(''); const [desc, setDesc] = useState(''); const [lines, setLines] = useState<Line[]>([blank()]);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | { queued: boolean; outstanding?: number; amount: string }>(null);

  // preselected customer (?customer=id)
  useEffect(() => {
    const id = sp.get('customer'); if (!id) return;
    fetchCustomer(id).then(({ customer: c, balance: b }) => setCustomer({ id: c.id, name: c.name, phone: c.phone, outstanding: Number(b.outstanding) }))
      .catch(() => { const hit = readCustomerCache()?.rows.find((r) => r.id === id); if (hit) setCustomer(hit); });
  }, [sp]);
  useEffect(() => { fetchProducts().then((p) => setProducts(p.filter((x) => x.is_active))).catch(() => undefined); }, []);
  // bill from the calculator
  useEffect(() => {
    const raw = sessionStorage.getItem(BILL_DRAFT_KEY); if (!raw) return;
    try { const d = JSON.parse(raw) as Line[]; if (Array.isArray(d) && d.length) { setLines(d); setMode('items'); } } catch { /* ignore */ }
    sessionStorage.removeItem(BILL_DRAFT_KEY);
  }, []);

  const lineP = (l: Line) => { const p = parseAmount(l.price); const q = Number(l.qty); return p !== null && q > 0 ? lineTotal(q, p) : 0; };
  const itemsTotal = useMemo(() => sumPaise(lines.map(lineP)), [lines]);
  const quickP = parseAmount(amount);
  const totalP = mode === 'quick' ? (quickP ?? 0) : itemsTotal;
  const validItems = lines.filter((l) => l.name.trim() && lineP(l) > 0);
  const canSave = !!customer && totalP > 0 && (mode === 'quick' || validItems.length > 0);

  async function submit() {
    if (!customer) { setErr(t('chooseCustomerFirst')); return; }
    if (totalP <= 0) { setErr(t('enterAmount')); return; }
    if (busy) return;
    setBusy(true); setErr(null);
    const items = mode === 'items' ? validItems.map((l) => ({ name: l.name.trim(), quantity: Number(l.qty), unit_price: toDecimalString(parseAmount(l.price)!) })) : null;
    if (mode === 'items' && items && sumPaise(validItems.map(lineP)) !== totalP) { setErr(t('ITEMS_TOTAL_MISMATCH')); setBusy(false); return; }
    const payload: PurchasePayload = {
      customer_id: customer.id, amount: toDecimalString(totalP), description: desc.trim() || null, items,
      client_txn_id: idFor(JSON.stringify([customer.id, totalP, desc.trim(), items])), occurred_at: new Date().toISOString(),
    };
    try {
      const r = await save('purchase', payload, { customerName: customer.name, amount: payload.amount });
      setDone(r.status === 'saved' ? { queued: false, outstanding: r.result.outstanding, amount: payload.amount } : { queued: true, amount: payload.amount });
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  function again() { reset(); setAmount(''); setDesc(''); setLines([blank()]); setCustomer(null); setDone(null); setErr(null); }

  if (done && customer) return (
    <Card><SuccessPanel queued={done.queued} title={done.queued ? t('pendingSync') : t('purchaseSaved')}
      actions={<><Button big onClick={again}>{t('addMore')}</Button><Link href={`/customers/${customer.id}`}><Button big variant="outline" className="w-full">{t('goToCustomer')}</Button></Link></>}>
      <p className="text-xl font-bold">{customer.name} · {formatINR(done.amount)}</p>
      {done.queued ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-base text-amber-700">{t('savedOfflineBody')}</p>
        : <p className="mt-2 text-base text-ink/60">{t('newOutstanding')}: <b className="text-2xl text-amber-700"><MoneyCounter paise={toPaise(done.outstanding)} /></b></p>}
    </SuccessPanel></Card>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-black">{t('addPurchase')}</h1>
      {!customer ? (
        <div className="space-y-3"><p className="text-lg font-semibold text-ink/70">{t('chooseCustomer')}</p><CustomerPicker onPick={setCustomer} /></div>
      ) : (
        <>
          <Card className="flex items-center gap-3 p-4">
            <Avatar name={customer.name} /><div className="min-w-0 flex-1"><p className="truncate text-xl font-bold">{customer.name}</p>
              <p className="text-base text-ink/60">{t('outstanding')}: {formatINR(customer.outstanding)}</p></div>
            <Button variant="soft" className="min-h-[48px] px-4" onClick={() => setCustomer(null)}>{t('changeCustomer')}</Button>
          </Card>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'quick', label: t('quickEntry') }, { value: 'items', label: t('itemWise') }]} />
          {mode === 'quick' ? (
            <Field label={t('purchaseAmount')} htmlFor="amt"><AmountInput id="amt" value={amount} onValueChange={setAmount} autoFocus /></Field>
          ) : (
            <div className="space-y-3">
              <datalist id="products">{products.map((p) => <option key={p.id} value={p.name} />)}</datalist>
              {lines.map((l, i) => (
                <Card key={i} className="space-y-3 p-4">
                  <div className="flex gap-2">
                    <Input list="products" placeholder={t('itemName')} value={l.name} onChange={(e) => {
                      const name = e.target.value; const hit = products.find((p) => p.name === name);
                      setLines(lines.map((x, j) => (j === i ? { ...x, name, price: x.price || (hit && hit.default_price > 0 ? String(hit.default_price) : '') } : x)));
                    }} />
                    {lines.length > 1 && <button aria-label={t('remove')} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-danger-600 hover:bg-danger-50"><Trash2 className="h-5 w-5" /></button>}
                  </div>
                  <div className="grid grid-cols-[1fr_1.4fr_auto] items-end gap-2">
                    <label className="text-sm font-semibold text-ink/60">{t('qty')}<Input inputMode="decimal" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value.replace(/[^\d.]/g, '') } : x)))} /></label>
                    <label className="text-sm font-semibold text-ink/60">{t('rate')} ₹<Input inputMode="decimal" placeholder="0" value={l.price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, '') } : x)))} /></label>
                    <p className="pb-3 text-right text-xl font-extrabold tabular-nums">{formatPaise(lineP(l))}</p>
                  </div>
                </Card>
              ))}
              <Button variant="outline" className="w-full" onClick={() => setLines([...lines, blank()])}><Plus className="h-5 w-5" />{t('addItem')}</Button>
              <div className="flex items-center justify-between rounded-3xl bg-brand-800 px-5 py-4 text-white"><span className="text-lg font-semibold">{t('grandTotal')}</span><span className="text-3xl font-extrabold tabular-nums">{formatPaise(itemsTotal)}</span></div>
            </div>
          )}
          <Field label={t('whatBought')} htmlFor="d" optional><Textarea id="d" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} rows={2} /></Field>
          {err && <ErrorBox message={err} />}
          <Button big className="w-full" loading={busy} disabled={!canSave} onClick={submit}>{t('savePurchase')}{totalP > 0 ? ` · ${formatPaise(totalP)}` : ''}</Button>
          <Badge tone="gray">{t('quickEntry')} / {t('itemWise')}</Badge>
        </>
      )}
    </div>
  );
}
export default function PurchasePage() { return <Suspense><PurchaseInner /></Suspense>; }
