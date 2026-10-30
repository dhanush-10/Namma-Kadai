'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Delete, Minus, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Segmented } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { formatPaise, lineTotal, parseAmount, sumPaise, toDecimalString } from '@/lib/money';
import { cn } from '@/lib/utils';

type Op = '+' | '-' | '×' | '÷';
const clean = (n: number) => Number(n.toFixed(8));
function apply(a: number, b: number, op: Op): number {
  switch (op) { case '+': return clean(a + b); case '-': return clean(a - b); case '×': return clean(a * b); case '÷': return b === 0 ? NaN : clean(a / b); }
}
const fmt = (s: string) => { if (s === 'Error') return s; const [w, f] = s.split('.'); const n = Number(w); const wf = Number.isFinite(n) ? new Intl.NumberFormat('en-IN').format(n) : w; return f !== undefined ? `${wf}.${f}` : wf; };

export function BasicCalculator({ compact = false }: { compact?: boolean }) {
  const [cur, setCur] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(false); // next digit starts a new number
  const [trail, setTrail] = useState('');
  const box = useRef<HTMLDivElement>(null);

  const digit = useCallback((d: string) => {
    setCur((c) => {
      if (c === 'Error' || fresh) return d === '.' ? '0.' : d;
      if (d === '.') return c.includes('.') ? c : c + '.';
      if (c.replace('.', '').length >= 12) return c;
      return c === '0' ? d : c + d;
    });
    setFresh(false);
  }, [fresh]);
  const chooseOp = useCallback((next: Op) => {
    const v = Number(cur);
    if (cur === 'Error') return;
    if (acc !== null && op && !fresh) {
      const r = apply(acc, v, op);
      if (Number.isNaN(r)) { setCur('Error'); setAcc(null); setOp(null); setTrail(''); return; }
      setAcc(r); setCur(String(r)); setTrail(`${fmt(String(r))} ${next}`);
    } else { setAcc(v); setTrail(`${fmt(cur)} ${next}`); }
    setOp(next); setFresh(true);
  }, [acc, cur, fresh, op]);
  const equals = useCallback(() => {
    if (acc === null || !op || cur === 'Error') return;
    const r = apply(acc, Number(cur), op);
    setTrail(`${fmt(String(acc))} ${op} ${fmt(cur)} =`);
    setCur(Number.isNaN(r) ? 'Error' : String(r)); setAcc(null); setOp(null); setFresh(true);
  }, [acc, cur, op]);
  const clear = () => { setCur('0'); setAcc(null); setOp(null); setFresh(false); setTrail(''); };
  const back = useCallback(() => { setCur((c) => (fresh || c === 'Error' || c.length <= 1 ? '0' : c.slice(0, -1))); }, [fresh]);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9.]$/.test(e.key)) digit(e.key);
      else if (e.key === ',') digit('.');
      else if (e.key === '+') chooseOp('+'); else if (e.key === '-') chooseOp('-');
      else if (e.key === '*' || e.key.toLowerCase() === 'x') chooseOp('×'); else if (e.key === '/') chooseOp('÷');
      else if (e.key === 'Enter' || e.key === '=') equals(); else if (e.key === 'Backspace') back();
      else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') clear(); else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [digit, chooseOp, equals, back]);

  const key = 'min-h-[60px] rounded-2xl text-2xl font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-400';
  const rows: (string | Op)[][] = [['7', '8', '9', '÷'], ['4', '5', '6', '×'], ['1', '2', '3', '-'], ['0', '.', '=', '+']];
  return (
    <div ref={box} className="space-y-3">
      <div className="rounded-3xl bg-brand-900 p-4 text-right text-white" aria-live="polite">
        <div className="h-6 truncate text-base text-brand-200">{trail}</div>
        <div className={cn('truncate font-bold tabular-nums', compact ? 'text-4xl' : 'text-5xl')}>{fmt(cur)}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button className={cn(key, 'col-span-2 bg-danger-100 text-danger-700')} onClick={clear}>C</button>
        <button className={cn(key, 'col-span-2 grid place-items-center bg-brand-100 text-brand-800')} onClick={back} aria-label="backspace"><Delete className="h-7 w-7" /></button>
        {rows.flat().map((k) => (
          <button key={k} onClick={() => (k === '=' ? equals() : '+-×÷'.includes(k) ? chooseOp(k as Op) : digit(k))}
            className={cn(key, k === '=' ? 'bg-brand-700 text-white' : '+-×÷'.includes(k) ? 'bg-brand-200 text-brand-900' : 'bg-white text-ink shadow-soft')}>{k}</button>
        ))}
      </div>
    </div>
  );
}

export interface BillLine { name: string; qty: string; price: string }
export const BILL_DRAFT_KEY = 'nk_bill_draft';

export function BillCalculator({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n(); const router = useRouter();
  const [lines, setLines] = useState<BillLine[]>([]);
  const [d, setD] = useState<BillLine>({ name: '', qty: '1', price: '' });
  const price = parseAmount(d.price); const qty = Number(d.qty);
  const valid = price !== null && qty > 0 && /^\d+(\.\d{1,3})?$/.test(d.qty);
  const lineP = (l: BillLine) => lineTotal(Number(l.qty), parseAmount(l.price) ?? 0);
  const total = sumPaise(lines.map(lineP));
  const add = () => { if (!valid) return; setLines((x) => [...x, d]); setD({ name: '', qty: '1', price: '' }); };
  const useIt = () => {
    sessionStorage.setItem(BILL_DRAFT_KEY, JSON.stringify(lines.map((l, i) => ({ name: l.name.trim() || `#${i + 1}`, qty: l.qty, price: l.price }))));
    onNavigate?.(); router.push('/purchase?mode=items');
  };
  const cell = 'min-h-[52px] rounded-xl border-2 border-brand-100 bg-white px-3 text-lg focus:border-brand-500 focus:outline-none';
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <input className={cn(cell, 'w-full')} placeholder={t('itemName')} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm font-semibold text-ink/70">{t('qty')}
            <input className={cn(cell, 'w-full')} inputMode="decimal" value={d.qty} onChange={(e) => setD({ ...d, qty: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          <label className="space-y-1 text-sm font-semibold text-ink/70">{t('rate')} (₹)
            <input className={cn(cell, 'w-full')} inputMode="decimal" placeholder="0" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value.replace(/[^\d.]/g, '') })}
              onKeyDown={(e) => e.key === 'Enter' && add()} /></label>
        </div>
        <Button className="w-full" onClick={add} disabled={!valid}><Plus className="h-5 w-5" />{t('addToBill')}</Button>
      </Card>
      {lines.length === 0 ? <p className="py-4 text-center text-ink/50">{t('emptyBill')}</p> : (
        <ul className="divide-y divide-brand-100 rounded-3xl bg-white px-4 shadow-soft">
          {lines.map((l, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="truncate text-lg font-semibold">{l.name || `#${i + 1}`}</p>
                <p className="text-base text-ink/60">{l.qty} × {formatPaise(parseAmount(l.price) ?? 0)}</p></div>
              <p className="text-xl font-bold tabular-nums">{formatPaise(lineP(l))}</p>
              <button aria-label={t('remove')} onClick={() => setLines((x) => x.filter((_, j) => j !== i))} className="grid h-12 w-12 place-items-center rounded-full text-danger-600 hover:bg-danger-50"><Trash2 className="h-5 w-5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between rounded-3xl bg-brand-800 px-5 py-4 text-white">
        <span className="text-lg font-semibold">{t('billTotal')}</span><span className="text-3xl font-extrabold tabular-nums">{formatPaise(total)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => setLines([])} disabled={!lines.length}><Minus className="h-5 w-5" />{t('clear')}</Button>
        <Button onClick={useIt} disabled={!lines.length || total <= 0}>{t('useInPurchase')}</Button>
      </div>
      <span className="hidden">{toDecimalString(total)}</span>
    </div>
  );
}

export function CalculatorTabs({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n(); const [tab, setTab] = useState<'basic' | 'bill'>('basic');
  return (
    <div className="space-y-4">
      <Segmented value={tab} onChange={setTab} options={[{ value: 'basic', label: t('quickCalc') }, { value: 'bill', label: t('shoppingCalc') }]} />
      {tab === 'basic' ? <BasicCalculator /> : <BillCalculator onNavigate={onNavigate} />}
    </div>
  );
}
