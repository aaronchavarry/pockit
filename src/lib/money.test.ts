import { describe, expect, it } from "vitest";
import { currencyDigits, isValidCurrencyCode, normalizeDecimal, parseAmount, percentOf, toDecimalString } from "./money";

describe("parseAmount", () => {
  it.each([
    ["4.50", "EUR", 450],
    ["4,50", "EUR", 450],
    ["12", "USD", 1200],
    ["1,234.56", "EUR", 123456],
    ["1.234,56", "EUR", 123456],
    ["0.1", "EUR", 10],
    ["1500", "JPY", 1500],
    ["4.567", "EUR", 456700], // single separator + 3 digits = thousands grouping
  ])("parses %s %s → %i", (input, currency, expected) => {
    expect(parseAmount(input, currency)).toEqual({ ok: true, amountMinor: expected });
  });

  it("is exact where floats are not (0.1 + 0.2 style values)", () => {
    const a = parseAmount("0.10", "EUR");
    const b = parseAmount("0.20", "EUR");
    expect(a.ok && b.ok && a.amountMinor + b.amountMinor).toBe(30);
  });

  it.each(["", "abc", "0", "-5", "1.234.5", "4.5678"])("rejects %j", (input) => {
    expect(parseAmount(input, "EUR").ok).toBe(false);
  });

  it("rejects decimals for zero-decimal currencies", () => {
    expect(parseAmount("10.5", "JPY").ok).toBe(false);
  });
});

describe("helpers", () => {
  it("normalizes separators", () => {
    expect(normalizeDecimal("1,234")).toBe("1234");
    expect(normalizeDecimal("12,5")).toBe("12.5");
  });
  it("round-trips minor units to editable strings", () => {
    expect(toDecimalString(450, "EUR")).toBe("4.50");
    expect(toDecimalString(5, "EUR")).toBe("0.05");
    expect(toDecimalString(1500, "JPY")).toBe("1500");
  });
  it("knows currency digits", () => {
    expect(currencyDigits("EUR")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
  });
  it("validates ISO codes", () => {
    expect(isValidCurrencyCode("EUR")).toBe(true);
    expect(isValidCurrencyCode("eur")).toBe(false);
    expect(isValidCurrencyCode("E1R")).toBe(false);
  });
  it("computes floored percentages", () => {
    expect(percentOf(799, 1000)).toBe(79);
    expect(percentOf(1500, 1000)).toBe(150);
    expect(percentOf(10, 0)).toBe(0);
  });
});
