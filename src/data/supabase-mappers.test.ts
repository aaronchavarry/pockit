import { describe, expect, it } from "vitest";
import { seedBudgets, seedCategories, seedExpenses } from "./seed";
import {
  budgetFromRow,
  budgetToRow,
  categoryFromRow,
  categoryToRow,
  expenseFromRow,
  expenseToRow,
  preferencesFromRow,
  preferencesToRow,
} from "./supabase-mappers";

describe("supabase row mappers", () => {
  it("round-trips every seed record without loss", () => {
    for (const e of seedExpenses("2026-10-30", "Europe/Tallinn")) expect(expenseFromRow(expenseToRow(e))).toEqual(e);
    for (const b of seedBudgets("2026-10-30")) expect(budgetFromRow(budgetToRow(b))).toEqual(b);
    for (const c of seedCategories()) expect(categoryFromRow(categoryToRow(c))).toEqual(c);
    const p = { defaultCurrency: "EUR", locale: "en-IE", timezone: "Europe/Tallinn" };
    expect(preferencesFromRow(preferencesToRow(p))).toEqual(p);
  });

  it("normalises Postgres values", () => {
    const [e] = seedExpenses("2026-10-30", "Europe/Tallinn");
    const row = { ...expenseToRow(e!), occurred_time: "18:15:00", amount_minor: "2450" as unknown as number };
    const back = expenseFromRow(row);
    expect(back.occurredTime).toBe("18:15");
    expect(back.amountMinor).toBe(2450);
  });
});
