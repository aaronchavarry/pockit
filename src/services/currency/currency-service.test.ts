import { describe, expect, it } from "vitest";
import { StaticCurrencyRateService } from "./currency-service";

const fx = new StaticCurrencyRateService([
  { baseCurrency: "EUR", quoteCurrency: "USD", rate: "1.0850", rateDate: "2026-10-01", source: "test", isDemoRate: true },
  { baseCurrency: "EUR", quoteCurrency: "JPY", rate: "162.50", rateDate: "2026-10-01", source: "test", isDemoRate: true },
]);

describe("StaticCurrencyRateService", () => {
  it("returns same-currency amounts unchanged", () => {
    expect(fx.convert(1234, "EUR", "EUR")).toEqual({ ok: true, amountMinor: 1234, rate: null });
  });

  it("converts with exact integer math and rounding", () => {
    expect(fx.convert(10000, "EUR", "USD")).toMatchObject({ ok: true, amountMinor: 10850 });
    expect(fx.convert(1200, "USD", "EUR")).toMatchObject({ ok: true, amountMinor: 1106 }); // 11.0599… → 11.06
  });

  it("handles different minor-unit digits", () => {
    expect(fx.convert(100, "EUR", "JPY")).toMatchObject({ ok: true, amountMinor: 163 }); // €1 → ¥162.5 → 163
    expect(fx.convert(16250, "JPY", "EUR")).toMatchObject({ ok: true, amountMinor: 10000 });
  });

  it("cross-converts through the base currency", () => {
    const r = fx.convert(10850, "USD", "JPY");
    expect(r).toMatchObject({ ok: true, amountMinor: 16250 });
  });

  it("reports missing rates instead of assuming 1:1", () => {
    expect(fx.convert(100, "EUR", "XAF")).toEqual({ ok: false, reason: "rate_unavailable" });
  });

  it("labels demo data", () => {
    expect(fx.describe()).toMatchObject({ isDemoRate: true });
  });

  it("stays exact for large amounts", () => {
    const r = fx.convert(9_000_000_000_000, "EUR", "USD");
    expect(r).toMatchObject({ ok: true, amountMinor: 9_765_000_000_000 });
  });
});
