'use client';
import { useCallback } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { classifyError } from '@/lib/errors';
export function useErrText() {
  const { t } = useI18n();
  return useCallback((e: unknown) => { const c = classifyError(e).code; return c === 'UNKNOWN' ? t('errGeneric') : t(c); }, [t]);
}
