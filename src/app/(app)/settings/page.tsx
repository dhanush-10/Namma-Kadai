'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, LogOut, Smartphone } from 'lucide-react';
import { Button, Card, ErrorBox, Segmented, Skeleton } from '@/components/ui';
import { useAsync } from '@/lib/hooks/useAsync';
import { useErrText } from '@/lib/hooks/useErrText';
import { useI18n } from '@/lib/i18n/provider';
import { fetchAll, fetchCustomers, fetchSettings } from '@/lib/data';
import { getSupabase } from '@/lib/supabase/client';
import { downloadText, toCSV } from '@/lib/csv';
import { formatDateTime, todayIST } from '@/lib/dates';
import type { Lang, Txn } from '@/lib/types';

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const BACKUP_KEY = 'nk_last_backup';

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n(); const errText = useErrText(); const router = useRouter();
  const { data, error, loading, reload } = useAsync(fetchSettings, []);
  const [advance, setAdvance] = useState(false);
  const [installEv, setInstallEv] = useState<BIPEvent | null>(null); const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); const [last, setLast] = useState<string | null>(null); const [exportErr, setExportErr] = useState<string | null>(null);

  useEffect(() => { if (data?.settings) setAdvance(data.settings.allow_advance); }, [data]);
  useEffect(() => {
    setLast(localStorage.getItem(BACKUP_KEY));
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    const h = (e: Event) => { e.preventDefault(); setInstallEv(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  async function changeLang(l: Lang) { setLang(l); await getSupabase().from('app_settings').update({ language: l, updated_at: new Date().toISOString() }).eq('shop_id', data!.shop!.id); }
  async function toggleAdvance(v: boolean) {
    setAdvance(v);
    const { error } = await getSupabase().from('app_settings').update({ allow_advance: v, updated_at: new Date().toISOString() }).eq('shop_id', data!.shop!.id);
    if (error) { setAdvance(!v); setExportErr(errText(error)); }
  }
  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key); setExportErr(null);
    try { await fn(); const now = new Date().toISOString(); localStorage.setItem(BACKUP_KEY, now); setLast(now); } catch (e) { setExportErr(errText(e)); } finally { setBusy(null); }
  }
  const exportCustomers = () => run('c', async () => {
    const rows = await fetchCustomers({ includeInactive: true });
    downloadText(`namma-kadai-customers-${todayIST()}.csv`, toCSV(['No', 'Name', 'Phone', 'Address', 'Notes', 'Opening balance', 'Outstanding', 'Active', 'Created'],
      rows.map((c) => [c.customer_no, c.name, c.phone, c.address, c.notes, c.opening_balance, c.outstanding, c.is_active, c.created_at])));
  });
  const exportTxns = () => run('t', async () => {
    const [txns, cs] = await Promise.all([fetchAll<Txn>('transactions', 'occurred_at'), fetchCustomers({ includeInactive: true })]);
    const names = new Map(cs.map((c) => [c.id, c.name])); const rev = new Set(txns.map((x) => x.reverses_transaction_id).filter(Boolean));
    downloadText(`namma-kadai-transactions-${todayIST()}.csv`, toCSV(['Date (IST)', 'Customer', 'Type', 'Amount', 'Method', 'Description', 'Cancelled', 'Is reversal', 'ID'],
      txns.map((x) => [new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23' }).format(new Date(x.occurred_at)), names.get(x.customer_id) ?? '', x.type, x.amount, x.payment_method, x.description, rev.has(x.id), !!x.reverses_transaction_id, x.id])));
  });
  const exportAll = () => run('a', async () => {
    const tables = ['shops', 'customers', 'products', 'transactions', 'transaction_items', 'cash_sales', 'app_settings', 'audit_log'];
    const out: Record<string, unknown> = { app: 'NAMMA KADAI', exported_at: new Date().toISOString(), version: 1 };
    for (const tb of tables) out[tb] = await fetchAll(tb, tb === 'app_settings' ? 'shop_id' : tb === 'shops' ? 'created_at' : 'created_at').catch(async () => fetchAll(tb, 'id'));
    downloadText(`namma-kadai-backup-${todayIST()}.json`, JSON.stringify(out, null, 2), 'application/json');
  });
  const daysSince = last ? (Date.now() - new Date(last).getTime()) / 86400000 : Infinity;

  if (error) return <ErrorBox message={errText(error)} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const isIOS = /iphone|ipad/i.test(navigator.userAgent);
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-black">{t('settings')}</h1>
      <Card className="space-y-3"><h2 className="text-xl font-extrabold">{t('language')}</h2>
        <Segmented<Lang> value={lang} onChange={changeLang} options={[{ value: 'ta', label: t('tamil') }, { value: 'en', label: t('english') }]} /></Card>
      <Card className="space-y-2"><label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4">
        <span><span className="block text-lg font-bold">{t('allowAdvance')}</span><span className="block text-sm text-ink/60">{t('allowAdvanceHint')}</span></span>
        <input type="checkbox" role="switch" className="h-8 w-8 shrink-0 accent-brand-700" checked={advance} onChange={(e) => toggleAdvance(e.target.checked)} /></label></Card>
      <Card className="space-y-3"><h2 className="flex items-center gap-2 text-xl font-extrabold"><Smartphone className="h-6 w-6 text-brand-700" />{t('install')}</h2>
        <p className="text-base text-ink/60">{t('installHint')}</p>
        {installed ? <p className="font-semibold text-brand-700">{t('installed')}</p> : installEv ? <Button className="w-full" onClick={() => installEv.prompt()}>{t('installNow')}</Button> : isIOS ? <p className="rounded-xl bg-brand-50 p-3">{t('installIos')}</p> : null}</Card>
      <Card className="space-y-3"><h2 className="text-xl font-extrabold">{t('backup')}</h2><p className="text-base text-ink/60">{t('backupHint')}</p>
        <p className="text-sm font-semibold text-ink/70">{t('lastBackup')}: {last ? formatDateTime(last, lang) : t('never')}</p>
        {daysSince > 7 && <p className="rounded-xl bg-amber-50 p-3 font-medium text-amber-700">{t('backupReminder')}</p>}
        {exportErr && <ErrorBox message={exportErr} />}
        <div className="grid gap-2">
          <Button variant="outline" loading={busy === 'c'} onClick={exportCustomers}><Download className="h-5 w-5" />{t('exportCustomers')}</Button>
          <Button variant="outline" loading={busy === 't'} onClick={exportTxns}><Download className="h-5 w-5" />{t('exportTransactions')}</Button>
          <Button loading={busy === 'a'} onClick={exportAll}><Download className="h-5 w-5" />{t('exportEverything')}</Button></div></Card>
      <Card className="space-y-1"><p className="text-sm text-ink/60">{t('shop')}</p><p className="text-xl font-bold">{data.shop?.name}</p><p className="text-sm text-ink/60">{t('signedInAs')}: {data.email}</p></Card>
      <Button variant="outline" className="w-full text-danger-600" onClick={async () => { await getSupabase().auth.signOut(); router.replace('/login'); router.refresh(); }}><LogOut className="h-5 w-5" />{t('logout')}</Button>
    </div>
  );
}
