'use client';
import { CloudOff } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';

export default function OfflinePage() {
  const { t } = useI18n();
  return <main className="grid min-h-dvh place-items-center px-5"><EmptyState icon={<CloudOff className="h-10 w-10" />} title={t('offlinePageTitle')} hint={t('offlinePageBody')} /></main>;
}
