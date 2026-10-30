'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, ErrorBox, Field, Input, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { useErrText } from '@/lib/hooks/useErrText';
import { getSupabase } from '@/lib/supabase/client';
import { getShopId } from '@/lib/data';
import { classifyError } from '@/lib/errors';
import { parseAmount, toDecimalString } from '@/lib/money';
import type { Customer } from '@/lib/types';

export function CustomerForm({ existing }: { existing?: Customer }) {
  const { t } = useI18n(); const errText = useErrText(); const router = useRouter(); const sp = useSearchParams();
  const [name, setName] = useState(existing?.name ?? sp.get('name') ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [opening, setOpening] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({}); const [fail, setFail] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    const er: Record<string, string> = {};
    if (!name.trim()) er.name = t('nameRequired');
    if (phone.trim() && !/^[0-9+ -]{6,15}$/.test(phone.trim())) er.phone = t('invalidPhone');
    let openP = 0;
    if (!existing && opening.trim()) { const p = parseAmount(opening); if (p === null) er.opening = t('INVALID_AMOUNT'); else openP = p; }
    setErrs(er); if (Object.keys(er).length) return;
    setBusy(true); setFail(null);
    const sb = getSupabase();
    const fields = { name: name.trim(), phone: phone.trim() || null, address: address.trim() || null, notes: notes.trim() || null };
    try {
      if (existing) {
        const { error } = await sb.from('customers').update(fields).eq('id', existing.id);
        if (error) throw error;
        router.replace(`/customers/${existing.id}`);
      } else {
        const shop_id = await getShopId();
        const { data, error } = await sb.from('customers').insert({ shop_id, ...fields, opening_balance: toDecimalString(openP) }).select('id').single();
        if (error) throw error;
        router.replace(`/customers/${data.id}`);
      }
      router.refresh();
    } catch (e) { setFail(errText(classifyError(e))); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h1 className="text-3xl font-black">{existing ? t('editCustomer') : t('addCustomer')}</h1>
      <Card className="space-y-4">
        <Field label={t('name')} htmlFor="n" error={errs.name}><Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus={!existing} autoComplete="off" /></Field>
        <Field label={t('phone')} htmlFor="p" optional error={errs.phone}><Input id="p" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} /></Field>
        <Field label={t('address')} htmlFor="a" optional><Input id="a" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} /></Field>
        <Field label={t('notes')} htmlFor="no" optional><Textarea id="no" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
        {!existing && (
          <Field label={t('openingBalance')} htmlFor="o" optional hint={t('openingBalanceHint')} error={errs.opening}>
            <Input id="o" inputMode="decimal" placeholder="₹0" value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^\d.]/g, ''))} />
          </Field>
        )}
      </Card>
      {fail && <ErrorBox message={fail} />}
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" big onClick={() => router.back()}>{t('cancel')}</Button>
        <Button type="submit" big loading={busy}>{t('save')}</Button>
      </div>
    </form>
  );
}
