import type { ExchangeRate } from "@/domain/types";
import type { PlainDate } from "@/lib/dates";
import { currencyDigits, type CurrencyCode } from "@/lib/money";
import { DEMO_RATES } from "./demo-rates";

export interface RateInfo {
  rateDate: PlainDate;
  source: string;
  isDemoRate: boolean;
}

export type ConversionResult =
  | { ok: true; amountMinor: number; rate: RateInfo | null }
  | { ok: false; reason: "rate_unavailable" };

/**
 * Converts money between currencies. All conversion goes through this
 * interface; UI never multiplies by rates itself. A live provider can
 * replace the static implementation later.
 */
export interface CurrencyRateService {
  convert(amountMinor: number, from: CurrencyCode, to: CurrencyCode, onDate?: PlainDate): ConversionResult;
  /** Describes the rate dataset, for labels like "Demo rates · 1 Oct". */
  describe(): RateInfo;
}

const SCALE_DIGITS = 8;
const SCALE = 10n ** BigInt(SCALE_DIGITS);

/** "1.0850" → 108500000n (scaled by 1e8). */
function scaleRate(rate: string): bigint | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(rate);
  if (!m) return null;
  const frac = (m[2] ?? "").slice(0, SCALE_DIGITS).padEnd(SCALE_DIGITS, "0");
  const v = BigInt(m[1]!) * SCALE + BigInt(frac || "0");
  return v > 0n ? v : null;
}

/** Integer division rounding half away from zero. */
function divRound(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  return r * 2n >= d ? q + 1n : q;
}

export class StaticCurrencyRateService implements CurrencyRateService {
  private readonly perEur = new Map<CurrencyCode, bigint>();
  private readonly info: RateInfo;

  constructor(rates: readonly ExchangeRate[] = DEMO_RATES, private readonly base: CurrencyCode = "EUR") {
    this.perEur.set(base, SCALE);
    for (const r of rates) {
      if (r.baseCurrency !== base) continue;
      const scaled = scaleRate(r.rate);
      if (scaled) this.perEur.set(r.quoteCurrency, scaled);
    }
    const first = rates[0];
    this.info = {
      rateDate: first?.rateDate ?? "1970-01-01",
      source: first?.source ?? "none",
      isDemoRate: first?.isDemoRate ?? true,
    };
  }

  convert(amountMinor: number, from: CurrencyCode, to: CurrencyCode): ConversionResult {
    if (from === to) return { ok: true, amountMinor, rate: null };
    const rFrom = this.perEur.get(from);
    const rTo = this.perEur.get(to);
    if (!rFrom || !rTo) return { ok: false, reason: "rate_unavailable" };
    // amount_to = amount_from / rFrom * rTo, adjusted for minor-unit digits.
    const num = BigInt(amountMinor) * rTo * 10n ** BigInt(currencyDigits(to));
    const den = rFrom * 10n ** BigInt(currencyDigits(from));
    return { ok: true, amountMinor: Number(divRound(num, den)), rate: this.info };
  }

  describe(): RateInfo {
    return this.info;
  }

  supports(currency: CurrencyCode): boolean {
    return this.perEur.has(currency);
  }
}

export const currencyService = new StaticCurrencyRateService();
