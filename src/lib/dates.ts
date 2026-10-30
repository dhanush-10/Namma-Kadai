export const TZ = 'Asia/Kolkata';

type Lang = 'ta' | 'en';
const locale = (l: Lang) => (l === 'ta' ? 'ta-IN' : 'en-IN');

export function formatDate(iso: string | Date, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
export function formatDateShort(iso: string | Date, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: TZ, day: 'numeric', month: 'short' }).format(new Date(iso));
}
export function formatTime(iso: string | Date, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
}
export function formatDateTime(iso: string | Date, lang: Lang = 'en'): string {
  return `${formatDate(iso, lang)}, ${formatTime(iso, lang)}`;
}
export function weekdayShort(isoDay: string, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', weekday: 'short' }).format(new Date(isoDay + 'T00:00:00Z'));
}

/** YYYY-MM-DD of "today" in India */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function addDays(isoDay: string, days: number): string {
  const d = new Date(isoDay + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function startOfMonth(isoDay: string): string { return isoDay.slice(0, 8) + '01'; }
export function startOfWeek(isoDay: string): string {
  const d = new Date(isoDay + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(isoDay, -dow);
}
/** India-local day boundaries as ISO instants, for filtering timestamptz columns */
export function dayStartISO(isoDay: string): string { return new Date(`${isoDay}T00:00:00+05:30`).toISOString(); }
export function dayEndISO(isoDay: string): string { return new Date(`${isoDay}T23:59:59.999+05:30`).toISOString(); }
