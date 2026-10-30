'use client';
import { useCallback, useRef } from 'react';
import { newId } from '@/lib/utils';

/**
 * Idempotency key for one entry. The SAME key is reused when the identical entry is submitted again
 * (double-tap, retry after a lost response) so the server can de-duplicate. If the person changed
 * anything, a NEW key is issued, so an edited retry can never be mistaken for the old entry.
 */
export function useClientId() {
  const id = useRef(newId()); const lastContent = useRef<string | null>(null);
  const idFor = useCallback((content: string) => {
    if (lastContent.current !== null && lastContent.current !== content) id.current = newId();
    lastContent.current = content; return id.current;
  }, []);
  const reset = useCallback(() => { id.current = newId(); lastContent.current = null; }, []);
  return { idFor, reset };
}
