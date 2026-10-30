'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BasketHero } from '@/components/BasketHero';
import { Button, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { getSupabase } from '@/lib/supabase/client';
import { classifyError } from '@/lib/errors';

export default function Setup() {
  const { t } = useI18n(); const router = useRouter();
  const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) { setErr(t('required')); return; }
    setBusy(true); setErr(null);
    const { error } = await getSupabase().rpc('bootstrap_shop', { p_shop_name: name.trim() });
    if (error) { const c = classifyError(error).code; setErr(c === 'SETUP_CLOSED' ? t('setupClosed') : t(c)); setBusy(false); return; }
    router.replace('/dashboard'); router.refresh();
  }
  return (
    <main className="mx-auto grid min-h-dvh max-w-md items-center px-5 py-8">
      <div className="rounded-4xl bg-white p-6 shadow-lift ring-1 ring-brand-900/5">
        <BasketHero className="!w-40" />
        <h1 className="mb-4 mt-2 text-center text-2xl font-extrabold">{t('setupTitle')}</h1>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('shopName')} htmlFor="s" error={err}><Input id="s" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus /></Field>
          <Button type="submit" big className="w-full" loading={busy}>{t('createShop')}</Button>
        </form>
      </div>
    </main>
  );
}
