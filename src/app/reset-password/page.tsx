'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { getSupabase } from '@/lib/supabase/client';

export default function ResetPassword() {
  const { t } = useI18n(); const router = useRouter();
  const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (pw.length < 8) { setErr(t('passwordMin')); return; }
    setBusy(true); setErr(null);
    const { error } = await getSupabase().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOk(true); setTimeout(() => { router.replace('/dashboard'); router.refresh(); }, 1200);
  }
  return (
    <main className="mx-auto grid min-h-dvh max-w-md items-center px-5 py-8">
      <div className="rounded-4xl bg-white p-6 shadow-lift ring-1 ring-brand-900/5">
        <h1 className="mb-4 text-2xl font-extrabold">{t('setNewPassword')}</h1>
        {ok ? <p role="status" className="rounded-2xl bg-brand-100 p-4 text-lg font-medium">{t('passwordUpdated')}</p> : (
          <form onSubmit={submit} className="space-y-4">
            <Field label={t('newPassword')} htmlFor="p" error={err}><Input id="p" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <Button type="submit" big className="w-full" loading={busy}>{t('save')}</Button>
          </form>
        )}
      </div>
    </main>
  );
}
