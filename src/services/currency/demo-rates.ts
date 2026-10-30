import type { ExchangeRate } from "@/domain/types";

/**
 * STATIC DEMO RATES — not live, not financially authoritative.
 * Approximate indicative values, fixed for the offline demo.
 * 1 EUR = rate × quote currency.
 */
export const DEMO_RATE_DATE = "2026-10-01";
export const DEMO_RATE_SOURCE = "Pockit static demo dataset";

const RAW: Record<string, string> = {
  USD: "1.0850",
  GBP: "0.8450",
  PEN: "4.0500",
  JPY: "162.50",
  CHF: "0.9400",
  SEK: "11.4500",
  NOK: "11.7000",
  DKK: "7.4600",
  PLN: "4.3000",
  CAD: "1.4800",
  AUD: "1.6300",
  MXN: "19.9000",
  BRL: "5.9500",
};

export const DEMO_RATES: readonly ExchangeRate[] = Object.entries(RAW).map(([quote, rate]) => ({
  baseCurrency: "EUR",
  quoteCurrency: quote,
  rate,
  rateDate: DEMO_RATE_DATE,
  source: DEMO_RATE_SOURCE,
  isDemoRate: true,
}));
