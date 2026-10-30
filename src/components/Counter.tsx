'use client';
import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { formatPaise } from '@/lib/money';

/** Animated rupee counter (value in paise). Jumps straight to the value if reduced-motion is on. */
export function MoneyCounter({ paise, className }: { paise: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? paise : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) { setShown(paise); return; }
    const c = animate(from.current, paise, { duration: 0.8, ease: 'easeOut', onUpdate: (v) => setShown(Math.round(v)) });
    from.current = paise;
    return () => c.stop();
  }, [paise, reduce]);
  return <span className={className} aria-label={formatPaise(paise)}>{formatPaise(shown)}</span>;
}
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion(); const [n, setN] = useState(reduce ? value : 0);
  useEffect(() => { if (reduce) { setN(value); return; } const c = animate(0, value, { duration: 0.7, onUpdate: (v) => setN(Math.round(v)) }); return () => c.stop(); }, [value, reduce]);
  return <span className={className}>{n}</span>;
}
