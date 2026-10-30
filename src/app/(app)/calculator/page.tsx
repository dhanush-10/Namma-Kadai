'use client';
import { CalculatorTabs } from '@/components/Calculator';
import { useI18n } from '@/lib/i18n/provider';
export default function CalculatorPage() {
  const { t } = useI18n();
  return <div className="space-y-4"><h1 className="text-3xl font-black">{t('calculator')}</h1><CalculatorTabs /></div>;
}
