'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Calculator as CalcIcon, CloudOff, Home, LayoutGrid, Plus, RefreshCw, Users, Wallet, Wifi } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sheet } from '@/components/ui';
import { CalculatorTabs } from '@/components/Calculator';
import { SyncProvider, useSync } from '@/lib/offline/SyncProvider';
import { useI18n } from '@/lib/i18n/provider';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  return <SyncProvider><Shell>{children}</Shell></SyncProvider>;
}

function Shell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n(); const path = usePathname(); const router = useRouter(); const reduce = useReducedMotion();
  const [calc, setCalc] = useState(false);
  const { pendingCount, syncing } = useSync();

  // pull saved language preference once
  useEffect(() => {
    getSupabase().from('app_settings').select('language').maybeSingle().then(({ data }: { data: { language: string } | null }) => {
      const saved = localStorage.getItem('nk_lang');
      if (!saved && data?.language) setLang(data.language as 'ta' | 'en');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setCalc(false); }, [path]);

  const nav = [
    { href: '/dashboard', label: t('navHome'), icon: Home },
    { href: '/customers', label: t('navCustomers'), icon: Users },
    { href: '/purchase', label: t('navPurchase'), icon: Plus, primary: true },
    { href: '/payment', label: t('navPayment'), icon: Wallet },
    { href: '/more', label: t('navMore'), icon: LayoutGrid },
  ];
  const active = (href: string) => path === href || (href !== '/dashboard' && path.startsWith(href + '/')) ||
    (href === '/more' && ['/calculator', '/reports', '/settings', '/products', '/sale', '/sync'].some((p) => path.startsWith(p)));
  void router;

  return (
    <div className="min-h-dvh md:flex">
      {/* desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-brand-900/5 bg-white/70 p-4 backdrop-blur md:flex">
        <div className="mb-4 flex items-center gap-3 px-2 pt-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-700 text-xl text-white">🧺</span>
          <div><p className="text-lg font-extrabold leading-tight text-brand-900">{t('appName')}</p><p className="text-xs text-ink/50">{t('tagline')}</p></div>
        </div>
        {[...nav.slice(0, 4), { href: '/calculator', label: t('navCalculator'), icon: CalcIcon }, { href: '/reports', label: t('navReports'), icon: LayoutGrid }, { href: '/settings', label: t('navSettings'), icon: LayoutGrid }].map((n) => (
          <Link key={n.href} href={n.href} className={cn('flex min-h-[52px] items-center gap-3 rounded-2xl px-4 text-lg font-semibold transition', active(n.href) ? 'bg-brand-700 text-white shadow-soft' : 'text-ink/70 hover:bg-brand-100')}>
            <n.icon className="h-5 w-5" />{n.label}
          </Link>
        ))}
        <div className="mt-auto"><StatusPill /></div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 bg-paper/85 px-4 py-3 backdrop-blur md:hidden">
          <span className="flex items-center gap-2 text-lg font-extrabold text-brand-900"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-lg text-white">🧺</span>{t('appName')}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')} className="min-h-[44px] rounded-full bg-white px-4 text-base font-bold text-brand-800 shadow-soft" aria-label={t('language')}>{lang === 'ta' ? 'EN' : 'த'}</button>
            <StatusPill compact />
          </div>
        </header>
        {pendingCount > 0 && (
          <Link href="/sync" className="no-print mx-4 mt-2 flex min-h-[52px] items-center gap-3 rounded-2xl bg-amber-100 px-4 font-semibold text-amber-700 md:mx-8">
            {syncing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CloudOff className="h-5 w-5" />}{t('pendingCount', { n: pendingCount })}
          </Link>
        )}
        <motion.main key={path} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          className="mx-auto w-full max-w-3xl px-4 pb-40 pt-4 md:px-8 md:pb-16 md:pt-8">{children}</motion.main>
      </div>

      {/* floating calculator, reachable from every screen */}
      <button onClick={() => setCalc(true)} aria-label={t('calculator')}
        className="no-print fixed bottom-24 right-4 z-40 grid h-16 w-16 place-items-center rounded-full bg-brand-900 text-white shadow-lift transition active:scale-95 md:bottom-8 md:right-8">
        <CalcIcon className="h-7 w-7" />
      </button>
      <Sheet open={calc} onClose={() => setCalc(false)} title={t('calculator')}><CalculatorTabs onNavigate={() => setCalc(false)} /></Sheet>

      {/* mobile bottom nav */}
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-brand-900/5 bg-white/95 backdrop-blur md:hidden" aria-label="Main">
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pb-1 pt-1">
          {nav.map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={active(n.href) ? 'page' : undefined} className="flex min-h-[64px] flex-col items-center justify-center gap-1 text-sm font-semibold">
                {n.primary ? (
                  <span className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-brand-700 text-white shadow-lift ring-4 ring-white"><n.icon className="h-7 w-7" /></span>
                ) : (
                  <n.icon className={cn('h-6 w-6', active(n.href) ? 'text-brand-700' : 'text-ink/45')} />
                )}
                <span className={cn(active(n.href) ? 'text-brand-800' : 'text-ink/55', n.primary && '-mt-1')}>{n.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function StatusPill({ compact = false }: { compact?: boolean }) {
  const { online, pendingCount } = useSync(); const { t } = useI18n();
  return (
    <span className={cn('inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-semibold', online ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-700')} role="status">
      {online ? <Wifi className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
      {!compact && (online ? t('online') : t('offline'))}{compact && !online && t('offline')}
      {pendingCount > 0 && <span className="rounded-full bg-amber-500 px-2 text-white">{pendingCount}</span>}
    </span>
  );
}
