'use client';
import { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Skeleton } from '@/components/ui';
import { useAsync } from '@/lib/hooks/useAsync';
import { useErrText } from '@/lib/hooks/useErrText';
import { useI18n } from '@/lib/i18n/provider';
import { fetchProducts, getShopId } from '@/lib/data';
import { getSupabase } from '@/lib/supabase/client';
import { formatINR, parseAmount, toDecimalString } from '@/lib/money';

export default function ProductsPage() {
  const { t } = useI18n(); const errText = useErrText();
  const { data, error, loading, reload } = useAsync(fetchProducts, []);
  const [name, setName] = useState(''); const [price, setPrice] = useState(''); const [unit, setUnit] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function add() {
    if (!name.trim()) { setErr(t('nameRequired')); return; }
    const p = price.trim() ? parseAmount(price) : 0; if (p === null) { setErr(t('INVALID_AMOUNT')); return; }
    setBusy(true); setErr(null);
    const { error } = await getSupabase().from('products').insert({ shop_id: await getShopId(), name: name.trim(), unit: unit.trim() || null, default_price: toDecimalString(p) });
    setBusy(false);
    if (error) { setErr(error.code === '23505' ? t('INVALID_REQUEST') : errText(error)); return; }
    setName(''); setPrice(''); setUnit(''); reload();
  }
  async function toggle(id: string, active: boolean) { await getSupabase().from('products').update({ is_active: !active }).eq('id', id); reload(); }
  return (
    <div className="space-y-4">
      <div><h1 className="text-3xl font-black">{t('products')}</h1><p className="text-base text-ink/60">{t('productsHint')}</p></div>
      <Card className="space-y-3">
        <Field label={t('itemName')} htmlFor="pn" error={err}><Input id="pn" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('defaultPrice')} htmlFor="pp" optional><Input id="pp" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} placeholder="₹" /></Field>
          <Field label={t('unit')} htmlFor="pu" optional><Input id="pu" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="kg / L" /></Field>
        </div>
        <Button className="w-full" loading={busy} onClick={add}><Plus className="h-5 w-5" />{t('addProduct')}</Button>
      </Card>
      {error ? <ErrorBox message={errText(error)} onRetry={reload} /> : loading ? <Skeleton className="h-40" /> : !data?.length ? <EmptyState icon={<Package className="h-10 w-10" />} title={t('noProducts')} /> : (
        <ul className="space-y-2">{data.map((p) => (
          <li key={p.id} className={`flex min-h-[64px] items-center gap-3 rounded-2xl bg-white px-4 shadow-soft ${p.is_active ? '' : 'opacity-50'}`}>
            <span className="min-w-0 flex-1"><span className="block truncate text-lg font-bold">{p.name}</span><span className="text-sm text-ink/55">{formatINR(p.default_price)}{p.unit ? ` / ${p.unit}` : ''}</span></span>
            {!p.is_active && <Badge tone="gray">{t('hide')}</Badge>}
            <Button variant="ghost" className="min-h-[44px] px-3" onClick={() => toggle(p.id, p.is_active)}>{p.is_active ? t('hide') : t('show')}</Button>
          </li>))}</ul>
      )}
    </div>
  );
}
