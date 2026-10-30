/**
 * Calendar-date utilities. Dates are plain `YYYY-MM-DD` strings in the
 * user's local calendar, so month/DST boundaries never shift a day.
 * All arithmetic runs on UTC midnights internally.
 */

export type PlainDate = string; // YYYY-MM-DD

const PLAIN_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isPlainDate(value: string): value is PlainDate {
  const m = PLAIN_DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

function parts(date: PlainDate): [number, number, number] {
  const m = PLAIN_DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function toUtc(date: PlainDate): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): PlainDate {
  const dt = new Date(ms);
  return makeDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function makeDate(year: number, month: number, day: number): PlainDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today in the given IANA timezone (defaults to the device timezone). */
export function today(timeZone?: string, now: Date = new Date()): PlainDate {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(p.find((x) => x.type === type)?.value);
  return makeDate(get("year"), get("month"), get("day"));
}

export function nowTime(timeZone?: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function addDays(date: PlainDate, days: number): PlainDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Adds months, clamping the day to the target month's length. */
export function addMonths(date: PlainDate, months: number, preferredDay?: number): PlainDate {
  const [y, m, d] = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeDate(ny, nm, Math.min(preferredDay ?? d, daysInMonth(ny, nm)));
}

export function diffDays(from: PlainDate, to: PlainDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(date: PlainDate): number {
  return (new Date(toUtc(date)).getUTCDay() + 6) % 7;
}

export function yearOf(date: PlainDate): number {
  return parts(date)[0];
}
export function monthOf(date: PlainDate): number {
  return parts(date)[1];
}
export function dayOf(date: PlainDate): number {
  return parts(date)[2];
}

export interface DateRange {
  start: PlainDate; // inclusive
  end: PlainDate; // inclusive
}

export function inRange(date: PlainDate, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

export function calendarWeek(date: PlainDate): DateRange {
  const start = addDays(date, -weekdayIndex(date));
  return { start, end: addDays(start, 6) };
}

export function calendarMonth(date: PlainDate): DateRange {
  const [y, m] = parts(date);
  return { start: makeDate(y, m, 1), end: makeDate(y, m, daysInMonth(y, m)) };
}

export function calendarYear(date: PlainDate): DateRange {
  const y = yearOf(date);
  return { start: makeDate(y, 1, 1), end: makeDate(y, 12, 31) };
}

export function formatDate(
  date: PlainDate,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opts }).format(new Date(toUtc(date)));
}

export function formatRange(range: DateRange, locale: string): string {
  const sameYear = yearOf(range.start) === yearOf(range.end);
  const startOpts: Intl.DateTimeFormatOptions = sameYear
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" };
  return `${formatDate(range.start, locale, startOpts)} – ${formatDate(range.end, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

/** Human label relative to today: Today, Yesterday, or a short date. */
export function relativeDayLabel(date: PlainDate, todayDate: PlainDate, locale: string): string {
  const diff = diffDays(date, todayDate);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const opts: Intl.DateTimeFormatOptions =
    yearOf(date) === yearOf(todayDate)
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" };
  return formatDate(date, locale, opts);
}
