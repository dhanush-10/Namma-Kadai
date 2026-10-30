/**
 * Money helpers. Amounts are handled as integer PAISE inside the app so there is never
 * floating-point drift, and sent to the database as exact decimal strings ("150.50").
 */
export type Paise = number;

const AMOUNT_RE = /^\d{1,8}(\.\d{1,2})?$/;

/** Parse user text like "1,250.5" into paise. Returns null if invalid / zero-less. */
export function parseAmount(input: string): Paise | null {
  const clean = input.replace(/[,\s₹]/g, '');
  if (!AMOUNT_RE.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

/** Database value (number or numeric string) -> paise */
export function toPaise(value: number | string | null | undefined): Paise {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** paise -> exact decimal string for the database, e.g. 15050 -> "150.50" */
export function toDecimalString(p: Paise): string {
  const sign = p < 0 ? '-' : '';
  const abs = Math.abs(p);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,25,000 — decimals shown only when needed. Accepts paise. */
export function formatPaise(p: Paise): string {
  const abs = Math.abs(p);
  const body = abs % 100 === 0 ? nf0.format(abs / 100) : nf2.format(abs / 100);
  return `${p < 0 ? '-' : ''}₹${body}`;
}

/** Format a DB numeric (rupees) directly. */
export function formatINR(value: number | string | null | undefined): string {
  return formatPaise(toPaise(value));
}

/** quantity (up to 3 decimals) × unit price (paise) -> paise, rounded half-up like Postgres round() */
export function lineTotal(quantity: number, unitPaise: Paise): Paise {
  return Math.round((Math.round(quantity * 1000) * unitPaise) / 1000);
}

export function sumPaise(values: Paise[]): Paise {
  return values.reduce((a, b) => a + b, 0);
}
