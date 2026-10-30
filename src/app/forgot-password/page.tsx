'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { getSupabase } from '@/lib/supabase/client';

export default function ForgotPassword() {
  const { t } = useI18n(); const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${site}/auth/callback?next=/reset-password` });
    setBusy(false);
    if (error && /fetch|network/i.test(error.message)) setErr(t('errNetwork')); else setSent(true); // never reveal whether the email exists
  }
  return (
    <main className="mx-auto grid min-h-dvh max-w-md items-center px-5 py-8">
      <div className="rounded-4xl bg-white p-6 shadow-lift ring-1 ring-brand-900/5">
        <h1 className="mb-4 text-2xl font-extrabold">{t('forgotPassword')}</h1>
        {sent ? <p className="rounded-2xl bg-brand-100 p-4 text-lg font-medium text-brand-900" role="status">{t('resetLinkSent')}</p> : (
          <form onSubmit={submit} className="space-y-4">
            <Field label={t('email')} htmlFor="e"><Input id="e" type="email" required inputMode="email" value={email} onChange={(ev) => setEmail(ev.target.value)} /></Field>
            {err && <p role="alert" className="font-medium text-danger-600">{err}</p>}
            <Button type="submit" big className="w-full" loading={busy} disabled={!email}>{t('sendResetLink')}</Button>
          </form>
        )}
        <Link href="/login" className="mt-4 block py-2 text-center text-lg font-semibold text-brand-700">{t('backToLogin')}</Link>
      </div>
    </main>
  );
}
