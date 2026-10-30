'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BasketHero } from '@/components/BasketHero';
import { Button, Field, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { getSupabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const { t, lang, setLang } = useI18n(); const router = useRouter(); const reduce = useReducedMotion();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setError(/fetch|network/i.test(error.message) ? t('errNetwork') : t('invalidLogin')); setBusy(false); return; }
    router.replace('/dashboard'); router.refresh();
  }
  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl items-center gap-6 px-5 py-8 md:grid-cols-2">
      <section className="text-center md:text-left">
        <BasketHero className="md:mx-0" />
        <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-brand-900">{t('appName')}</h1>
          <p className="mt-1 text-xl font-semibold text-brand-700">{t('tagline')}</p>
          <p className="mx-auto mt-3 max-w-sm text-lg text-ink/65 md:mx-0">{t('welcomeSub')}</p>
        </motion.div>
      </section>
      <section className="rounded-4xl bg-white p-6 shadow-lift ring-1 ring-brand-900/5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">{t('login')}</h2>
          <button onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')} className="min-h-[44px] rounded-full bg-brand-100 px-4 font-bold text-brand-800">{lang === 'ta' ? 'English' : 'தமிழ்'}</button>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t('email')} htmlFor="email"><Input id="email" type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t('password')} htmlFor="pw"><Input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <p role="alert" className="rounded-xl bg-danger-50 p-3 font-medium text-danger-700">{error}</p>}
          <Button type="submit" big className="w-full" loading={busy} disabled={!email || !password}>{t('login')}</Button>
          <Link href="/forgot-password" className="block py-2 text-center text-lg font-semibold text-brand-700 underline-offset-4 hover:underline">{t('forgotPassword')}</Link>
        </form>
      </section>
    </main>
  );
}
