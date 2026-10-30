'use client';
import Link from 'next/link';
import { BarChart3, Calculator, CloudUpload, Package, Settings, ShoppingBag, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { useSync } from '@/lib/offline/SyncProvider';
import { getSupabase } from '@/lib/supabase/client';

export default function More() {
  const { t } = useI18n(); const { pendingCount } = useSync(); const router = useRouter();
  const items = [
    { href: '/sale', label: t('navCashSale'), icon: ShoppingBag }, { href: '/calculator', label: t('navCalculator'), icon: Calculator },
    { href: '/reports', label: t('navReports'), icon: BarChart3 }, { href: '/products', label: t('navProducts'), icon: Package },
    { href: '/sync', label: t('syncStatus'), icon: CloudUpload, badge: pendingCount }, { href: '/settings', label: t('navSettings'), icon: Settings },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="relative flex min-h-[112px] flex-col justify-between rounded-3xl bg-white p-4 shadow-soft ring-1 ring-brand-900/5 transition active:scale-[.98]">
            <i.icon className="h-8 w-8 text-brand-700" /><span className="text-lg font-bold leading-tight">{i.label}</span>
            {!!i.badge && <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-sm font-bold text-white">{i.badge}</span>}
          </Link>
        ))}
      </div>
      <Card className="p-0"><button className="flex min-h-[64px] w-full items-center gap-3 px-5 text-lg font-bold text-danger-600"
        onClick={async () => { await getSupabase().auth.signOut(); router.replace('/login'); router.refresh(); }}><LogOut className="h-6 w-6" />{t('logout')}</button></Card>
    </div>
  );
}
