'use client';
import { forwardRef, useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/provider';

type Variant = 'primary' | 'soft' | 'ghost' | 'danger' | 'outline';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white shadow-soft hover:bg-brand-800 active:bg-brand-900 disabled:bg-brand-300',
  soft: 'bg-brand-100 text-brand-800 hover:bg-brand-200 active:bg-brand-300',
  ghost: 'text-brand-800 hover:bg-brand-100/70 active:bg-brand-100',
  outline: 'border-2 border-brand-200 bg-white text-brand-800 hover:bg-brand-50',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 disabled:bg-danger-100',
};
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; loading?: boolean; big?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', loading, big, className, children, disabled, ...p }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading} {...p}
      className={cn('inline-flex items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition-colors duration-150 select-none',
        'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed active:scale-[.985]',
        big ? 'min-h-[64px] text-xl' : 'min-h-[52px] text-base', variants[variant], className)}>
      {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn('rounded-3xl bg-white p-5 shadow-soft ring-1 ring-brand-900/5', className)}>{children}</div>;
}

export function Field({ label, hint, error, optional, children, htmlFor }: { label: string; hint?: string; error?: string | null; optional?: boolean; children: ReactNode; htmlFor?: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-base font-semibold text-ink">
        <span>{label}</span>{optional && <span className="text-sm font-normal text-ink/50">{t('optional')}</span>}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-ink/60">{hint}</p>}
      {error && <p role="alert" className="text-sm font-medium text-danger-600">{error}</p>}
    </div>
  );
}

const inputBase = 'w-full rounded-2xl border-2 border-brand-100 bg-white px-4 text-lg text-ink placeholder:text-ink/35 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-200/60 disabled:bg-paper';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cn(inputBase, 'min-h-[56px]', className)} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} {...p} className={cn(inputBase, 'min-h-[96px] py-3', className)} />;
});

/** big ₹ amount input with numeric keypad on phones */
export const AmountInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { value: string; onValueChange: (v: string) => void }>(
  function AmountInput({ value, onValueChange, className, ...p }, ref) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-bold text-brand-700" aria-hidden>₹</span>
        <input ref={ref} inputMode="decimal" autoComplete="off" enterKeyHint="done" placeholder="0" value={value} {...p}
          onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); const parts = v.split('.'); onValueChange(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : parts[1] !== undefined ? parts[0] + '.' + parts[1].slice(0, 2) : v); }}
          className={cn(inputBase, 'min-h-[76px] pl-12 text-4xl font-bold tabular-nums tracking-tight', className)} />
      </div>
    );
  });

export function Spinner({ className }: { className?: string }) { return <Loader2 className={cn('h-6 w-6 animate-spin text-brand-600', className)} aria-label="loading" />; }

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('relative overflow-hidden rounded-2xl bg-brand-100/60', className)}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
  </div>;
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 grid h-20 w-20 place-items-center rounded-full bg-brand-100 text-brand-700">{icon}</div>
      <p className="text-xl font-bold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-base text-ink/60">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-danger-50 p-4 text-danger-700 ring-1 ring-danger-100">
      <span className="font-medium">{message}</span>
      {onRetry && <Button variant="outline" className="min-h-[44px] px-4" onClick={onRetry}>{t('retry')}</Button>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'gray'; children: ReactNode }) {
  const tones = { green: 'bg-brand-100 text-brand-800', amber: 'bg-amber-100 text-amber-700', red: 'bg-danger-100 text-danger-700', gray: 'bg-ink/5 text-ink/70' };
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold', tones[tone])}>{children}</span>;
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-brand-100/60 p-1">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} type="button" onClick={() => onChange(o.value)}
          className={cn('min-h-[48px] rounded-xl px-3 text-base font-semibold transition', value === o.value ? 'bg-white text-brand-800 shadow-soft' : 'text-ink/60 hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const reduce = useReducedMotion(); const id = useId(); const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={id}>
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-4xl bg-paper p-5 pb-8 shadow-lift sm:max-w-md sm:rounded-4xl"
            initial={reduce ? { opacity: 0 } : { y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 id={id} className="text-xl font-bold text-ink">{title}</h2>
              <button onClick={onClose} aria-label={t('close')} className="grid h-12 w-12 place-items-center rounded-full text-ink/60 hover:bg-brand-100"><X className="h-6 w-6" /></button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
