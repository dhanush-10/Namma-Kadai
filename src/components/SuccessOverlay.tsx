'use client';
import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';

/** Green drawn checkmark for confirmed saves; amber clock for "waiting to be sent". */
export function SuccessPanel({ title, children, queued, actions }: { title: string; children?: ReactNode; queued?: boolean; actions: ReactNode }) {
  const { t } = useI18n();
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center px-2 py-6 text-center" role="status">
      {queued ? (
        <div className="mb-5 grid h-28 w-28 animate-pop place-items-center rounded-full bg-amber-100 text-amber-700"><Clock className="h-14 w-14" /></div>
      ) : (
        <div className="mb-5 grid h-28 w-28 animate-pop place-items-center rounded-full bg-brand-600 text-white shadow-lift">
          <svg viewBox="0 0 52 52" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 27l8 8 16-17" strokeDasharray="40" strokeDashoffset="40" className="animate-draw" />
          </svg>
        </div>
      )}
      {queued && <p className="mb-2 rounded-full bg-amber-500 px-4 py-1 text-sm font-bold text-white">{t('savedOffline')}</p>}
      <h2 className="text-2xl font-extrabold text-ink">{title}</h2>
      <div className="mt-3 w-full text-lg text-ink/80">{children}</div>
      <div className="mt-6 grid w-full gap-3">{actions}</div>
    </motion.div>
  );
}
