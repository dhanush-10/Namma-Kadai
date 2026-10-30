import { describe, expect, it } from 'vitest';
import { en } from '@/lib/i18n/en';
import { ta } from '@/lib/i18n/ta';
describe('i18n', () => {
  it('Tamil has every English key and no empty strings', () => {
    for (const k of Object.keys(en)) { expect((ta as Record<string, string>)[k], k).toBeTruthy(); }
  });
  it('Tamil text is real Tamil script for UI labels', () => { expect(ta.navHome).toMatch(/[\u0B80-\u0BFF]/); expect(ta.savePurchase).toMatch(/[\u0B80-\u0BFF]/); });
});
