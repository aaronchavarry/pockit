import { describe, expect, it } from "vitest";
import { parseExpenseText } from "./local-parser";

const ctx = { defaultCurrency: "EUR", today: "2026-10-30" };

describe("local expense parser", () => {
  it("parses “Coffee 4.50” with safe defaults", () => {
    const r = parseExpenseText("Coffee 4.50", ctx);
    expect(r).toMatchObject({
      ok: true,
      draft: {
        amountMinor: 450,
        currency: "EUR",
        description: "Coffee",
        merchant: null,
        occurredOn: "2026-10-30",
        occurredTime: null,
        recurrence: "none",
      },
    });
  });

  it("parses date, symbol currency, merchant and purpose", () => {
    const r = parseExpenseText("Yesterday I spent €24.50 at Rimi buying groceries", ctx);
    expect(r).toMatchObject({
      ok: true,
      draft: { amountMinor: 2450, currency: "EUR", description: "Groceries", merchant: "Rimi", occurredOn: "2026-10-29" },
    });
  });

  it("parses currency codes after the amount", () => {
    const r = parseExpenseText("Paid 12 USD for lunch", ctx);
    expect(r).toMatchObject({ ok: true, draft: { amountMinor: 1200, currency: "USD", description: "Lunch" } });
  });

  it("parses currency words, times and recurrence", () => {
    const r = parseExpenseText("Netflix 15.99 dollars every month at 9pm", ctx);
    expect(r).toMatchObject({
      ok: true,
      draft: { amountMinor: 1599, currency: "USD", description: "Netflix", recurrence: "monthly", occurredTime: "21:00" },
    });
  });

  it("understands weekdays and ISO dates", () => {
    // 2026-10-30 is a Friday → last Monday is 2026-10-26
    expect(parseExpenseText("Taxi 9 on Monday", ctx)).toMatchObject({ ok: true, draft: { occurredOn: "2026-10-26" } });
    expect(parseExpenseText("Taxi 9 on 2026-10-01", ctx)).toMatchObject({ ok: true, draft: { occurredOn: "2026-10-01" } });
  });

  it("asks for the amount when missing — never invents one", () => {
    const r = parseExpenseText("Lunch at Vapiano", ctx);
    expect(r).toMatchObject({ ok: false, missing: ["amount"] });
  });

  it("asks for a description when missing", () => {
    expect(parseExpenseText("€12", ctx)).toMatchObject({ ok: false, missing: ["description"] });
    expect(parseExpenseText("12.50 at Rimi", ctx)).toMatchObject({ ok: false, missing: ["description"] });
  });

  it("treats several bare numbers as ambiguous", () => {
    expect(parseExpenseText("2 coffees 9", ctx)).toMatchObject({ ok: false, missing: ["amount"] });
  });

  it("rejects empty input", () => {
    expect(parseExpenseText("   ", ctx).ok).toBe(false);
  });

  it("keeps explicit ISO dates, even upcoming ones", () => {
    const r = parseExpenseText("Dinner 30 on 2026-12-01", ctx);
    expect(r).toMatchObject({ ok: true, draft: { occurredOn: "2026-12-01", amountMinor: 3000 } });
  });
});
