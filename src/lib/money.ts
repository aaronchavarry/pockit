/**
 * Money is stored as integer minor units (e.g. cents) plus an ISO 4217 code.
 * Never use floating point for amounts: parse from strings, and use BigInt
 * for multiplication/division so large values stay exact.
 */

export type CurrencyCode = string;

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = [
  "EUR", "USD", "GBP", "PEN", "JPY", "CHF", "SEK", "NOK", "DKK", "PLN", "CAD", "AUD", "MXN", "BRL",
];

const CODE_RE = /^[A-Z]{3}$/;

export function isValidCurrencyCode(code: string): boolean {
  if (!CODE_RE.test(code)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
}

const digitsCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (EUR → 2, JPY → 0). */
export function currencyDigits(currency: CurrencyCode): number {
  const cached = digitsCache.get(currency);
  if (cached !== undefined) return cached;
  let digits = 2;
  try {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  digitsCache.set(currency, digits);
  return digits;
}

export type ParseAmountResult = { ok: true; amountMinor: number } | { ok: false; error: string };

/**
 * Parses a user-entered decimal string into minor units without floats.
 * Accepts "4.50", "4,50", "1,234.56", "1.234,56", "12".
 */
export function parseAmount(input: string, currency: CurrencyCode): ParseAmountResult {
  const raw = input.trim().replace(/\s/g, "");
  if (!raw) return { ok: false, error: "Enter an amount." };
  if (!/^[0-9.,]+$/.test(raw)) return { ok: false, error: "Use numbers only." };

  const normalized = normalizeDecimal(raw);
  if (normalized === null) return { ok: false, error: "That amount doesn't look right." };

  const digits = currencyDigits(currency);
  const [whole = "0", frac = ""] = normalized.split(".");
  if (frac.length > digits) {
    return {
      ok: false,
      error: digits === 0 ? `${currency} has no decimals.` : `Use at most ${digits} decimals.`,
    };
  }
  const minorStr = `${whole}${frac.padEnd(digits, "0")}`.replace(/^0+(?=\d)/, "");
  const value = Number(minorStr);
  if (!Number.isSafeInteger(value)) return { ok: false, error: "That amount is too large." };
  if (value <= 0) return { ok: false, error: "Amount must be greater than zero." };
  return { ok: true, amountMinor: value };
}

/**
 * Normalizes "1,234.56" / "1.234,56" / "4,5" to "1234.56" style.
 * Returns null when the string is not a well-formed number.
 */
export function normalizeDecimal(raw: string): string | null {
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  let decimalSep: "." | "," | null = null;
  let thousandsSep: "." | "," | null = null;

  if (lastDot >= 0 && lastComma >= 0) {
    decimalSep = lastDot > lastComma ? "." : ",";
    thousandsSep = decimalSep === "." ? "," : ".";
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const count = raw.split(sep).length - 1;
    const after = raw.length - raw.lastIndexOf(sep) - 1;
    // "1,234" / "1.234.567" → grouping; "4.5" / "4,50" → decimal.
    if (count > 1 || (after === 3 && raw.lastIndexOf(sep) > 0)) thousandsSep = sep;
    else decimalSep = sep;
  }

  let body = raw;
  let frac = "";
  if (decimalSep) {
    const idx = raw.lastIndexOf(decimalSep);
    body = raw.slice(0, idx);
    frac = raw.slice(idx + 1);
    if (!/^\d+$/.test(frac)) return null;
  }
  if (thousandsSep) {
    const groups = body.split(thousandsSep);
    if (!/^\d{1,3}$/.test(groups[0] ?? "") || groups.slice(1).some((g) => !/^\d{3}$/.test(g))) return null;
    body = groups.join("");
  }
  if (!/^\d*$/.test(body)) return null;
  const whole = body || "0";
  return frac ? `${whole}.${frac}` : whole;
}

/** Minor units → editable decimal string (450 EUR → "4.50"). */
export function toDecimalString(amountMinor: number, currency: CurrencyCode): string {
  const digits = currencyDigits(currency);
  if (digits === 0) return String(amountMinor);
  const s = String(Math.abs(amountMinor)).padStart(digits + 1, "0");
  const sign = amountMinor < 0 ? "-" : "";
  return `${sign}${s.slice(0, -digits)}.${s.slice(-digits)}`;
}

export interface FormatOptions {
  hideDecimals?: boolean;
}

export function formatMoney(
  amountMinor: number,
  currency: CurrencyCode,
  locale: string,
  opts: FormatOptions = {},
): string {
  const digits = currencyDigits(currency);
  // Display only: the exact value always lives in amountMinor.
  const major = amountMinor / 10 ** digits;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: opts.hideDecimals ? 0 : digits,
      maximumFractionDigits: opts.hideDecimals ? 0 : digits,
    }).format(major);
  } catch {
    return `${toDecimalString(amountMinor, currency)} ${currency}`;
  }
}

/** Formats only the number part, e.g. "1,234.50" (used for the big Home figure). */
export function formatNumber(amountMinor: number, currency: CurrencyCode, locale: string, hideDecimals = false): string {
  const digits = hideDecimals ? 0 : currencyDigits(currency);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    amountMinor / 10 ** currencyDigits(currency),
  );
}

export function currencySymbol(currency: CurrencyCode, locale: string): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Whole-number percentage of used / limit (floored). */
export function percentOf(usedMinor: number, limitMinor: number): number {
  if (limitMinor <= 0) return 0;
  return Number((BigInt(usedMinor) * 100n) / BigInt(limitMinor));
}
