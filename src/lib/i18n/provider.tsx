'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type DictKey } from './en';
import { ta } from './ta';
import type { Lang } from '@/lib/types';

const dicts: Record<Lang, Record<DictKey, string>> = { en, ta };
const STORAGE_KEY = 'nk_lang';

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: DictKey, vars?: Record<string, string | number>) => string }
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ta'); // Tamil is the default
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ta') setLangState(saved);
  }, []);
  useEffect(() => { document.documentElement.lang = lang === 'ta' ? 'ta' : 'en'; }, [lang]);

  const setLang = useCallback((l: Lang) => { setLangState(l); localStorage.setItem(STORAGE_KEY, l); }, []);
  const t = useCallback((k: DictKey, vars?: Record<string, string | number>) => {
    let s = dicts[lang][k] ?? dicts.en[k] ?? k;
    if (vars) for (const [name, v] of Object.entries(vars)) s = s.replace(`{${name}}`, String(v));
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error('useI18n must be used inside I18nProvider');
  return c;
}
