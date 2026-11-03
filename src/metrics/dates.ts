export const TZ = 'Asia/Kolkata';

const DAY_MS = 86_400_000;

/** UTC-midnight epoch ms for a YYYY-MM-DD string (no local-zone or DST drift). */
function utcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The calendar date (YYYY-MM-DD) of an instant in the given time zone. */
export function dateInTz(isoOrDate: Date | string, tz: string = TZ): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function todayIso(now: Date = new Date()): string {
  return dateInTz(now, TZ);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

/** ISO 8601 week label, e.g. '2026-W45'. */
export function isoWeek(date: string): string {
  const ms = utcMs(date);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Mon=0
  const thursday = ms + (3 - dow) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Monday to Sunday dates of an ISO week label. */
export function weekRange(week: string): { start: string; end: string } {
  const [y, w] = /^(\d{4})-W(\d{2})$/.exec(week)!.slice(1).map(Number) as [number, number];
  const jan4 = Date.UTC(y, 0, 4);
  const jan4Dow = (new Date(jan4).getUTCDay() + 6) % 7;
  const start = jan4 - jan4Dow * DAY_MS + (w - 1) * 7 * DAY_MS;
  return { start: fromUtcMs(start), end: fromUtcMs(start + 6 * DAY_MS) };
}
