import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/data/memory-store";
import type { Store } from "@/data/repositories";
import { seedCategories } from "@/data/seed";
import { budgetFor, budgetStatus, periodWindow } from "@/domain/budget";
import type { Budget, Expense } from "@/domain/types";
import { StaticCurrencyRateService } from "@/services/currency/currency-service";
import { closeBudget, createBudget, editBudget, validateBudgetInput, type BudgetFormInput } from "./budgets";
import { budgetProgress } from "./insights";

const categories = seedCategories();
const fx = new StaticCurrencyRateService();
const TODAY = "2026-10-30";

function input(over: Partial<BudgetFormInput>): BudgetFormInput {
  return {
    name: "",
    amount: "1000",
    currency: "EUR",
    scope: "overall",
    categoryId: "",
    periodType: "monthly",
    startDate: "2026-10-01",
    endDate: "",
    anchorDay: "",
    ...over,
  };
}

function make(over: Partial<BudgetFormInput>, budgets: Budget[] = []): Budget {
  const r = validateBudgetInput(input(over), { categories, budgets });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.value;
}

function expense(occurredOn: string, amountMinor: number, categoryId: string | null = null, currency = "EUR"): Expense {
  return {
    id: `e-${occurredOn}-${amountMinor}`,
    amountMinor,
    currency,
    description: "x",
    merchant: null,
    categoryId,
    occurredOn,
    occurredTime: null,
    timezone: "UTC",
    recurrence: "none",
    source: "manual",
    sourceReference: null,
    createdAt: "",
    updatedAt: "",
  };
}

describe("budget periods", () => {
  it("monthly runs 1st → last day", () => {
    expect(periodWindow(make({}), "2026-02-14")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("custom recurring runs 15th → 14th", () => {
    const b = make({ periodType: "custom_recurring", anchorDay: "15", startDate: "2026-09-15" });
    expect(periodWindow(b, "2026-10-30")).toEqual({ start: "2026-10-15", end: "2026-11-14" });
    expect(periodWindow(b, "2026-10-03")).toEqual({ start: "2026-09-15", end: "2026-10-14" });
    expect(periodWindow(b, "2026-12-20")).toEqual({ start: "2026-12-15", end: "2027-01-14" });
  });

  it("fixed range covers only its dates", () => {
    const b = make({ periodType: "fixed_range", startDate: "2026-11-10", endDate: "2026-11-25" });
    expect(periodWindow(b, "2026-11-12")).toEqual({ start: "2026-11-10", end: "2026-11-25" });
    expect(periodWindow(b, "2026-11-26")).toBeNull();
  });

  it("weekly and yearly", () => {
    expect(periodWindow(make({ periodType: "weekly" }), TODAY)).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(periodWindow(make({ periodType: "yearly" }), TODAY)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("status and activation", () => {
  it("derives scheduled → active → closed from dates (no scheduler)", () => {
    const b = make({ periodType: "fixed_range", startDate: "2026-11-10", endDate: "2026-11-25" });
    expect(budgetStatus(b, TODAY)).toBe("scheduled");
    expect(budgetStatus(b, "2026-11-10")).toBe("active");
    expect(budgetStatus(b, "2026-11-26")).toBe("closed");
  });

  it("selects the correct overall budget for a date", () => {
    const monthly = make({});
    const weekly = make({ periodType: "weekly", startDate: "2026-10-26" }, [monthly]);
    const all = [monthly, weekly];
    expect(budgetFor(all, { cadence: "month", date: TODAY, scope: "overall" })?.id).toBe(monthly.id);
    expect(budgetFor(all, { cadence: "week", date: TODAY, scope: "overall" })?.id).toBe(weekly.id);
    expect(budgetFor(all, { cadence: "week", date: "2026-10-20", scope: "overall" })).toBeNull();
  });
});

describe("validation", () => {
  it("prevents two overall budgets of the same cadence on the same dates", () => {
    const first = make({});
    const r = validateBudgetInput(input({ startDate: "2026-10-15" }), { categories, budgets: [first] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/overlaps/);
  });

  it("allows overall and category budgets to coexist", () => {
    const overall = make({});
    const r = validateBudgetInput(input({ scope: "category", categoryId: "cat-dining" }), { categories, budgets: [overall] });
    expect(r.ok).toBe(true);
  });

  it("allows a new budget after the previous one closed", () => {
    const first = { ...make({}), closedOn: "2026-10-31" };
    expect(validateBudgetInput(input({ startDate: "2026-11-01" }), { categories, budgets: [first] }).ok).toBe(true);
  });

  it("validates fields", () => {
    const r = validateBudgetInput(input({ amount: "", periodType: "custom_recurring", anchorDay: "31" }), { categories, budgets: [] });
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["amount", "anchorDay"]);
  });
});

describe("progress", () => {
  const expenses = [
    expense("2026-10-02", 30000),
    expense("2026-10-20", 50000, "cat-dining"),
    expense("2026-10-29", 1200, "cat-dining", "USD"),
    expense("2026-09-30", 99999),
  ];

  it("counts only the current period and converts currencies", () => {
    const p = budgetProgress(make({}), expenses, { date: TODAY, today: TODAY, fx });
    expect(p.spent.amountMinor).toBe(30000 + 50000 + 1106);
    expect(p.percent).toBe(81);
    expect(p.level).toBe("warning");
  });

  it("category budgets count only their category", () => {
    const b = make({ scope: "category", categoryId: "cat-dining", amount: "500" });
    const p = budgetProgress(b, expenses, { date: TODAY, today: TODAY, fx });
    expect(p.spent.amountMinor).toBe(51106);
    expect(p.level).toBe("over");
    expect(p.remainingMinor).toBe(-1106);
  });

  it("flags exactly 100% as reached", () => {
    const p = budgetProgress(make({ amount: "300" }), [expense("2026-10-02", 30000)], { date: TODAY, today: TODAY, fx });
    expect(p.level).toBe("reached");
  });
});

describe("editing keeps history", () => {
  let store: Store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it("closes the old version and creates a new one from today", async () => {
    const original = make({ startDate: "2026-09-01" });
    await createBudget(store, original);
    const r = await editBudget(store, original, { name: "", amount: "1500", endDate: "" }, { today: TODAY, budgets: [original], categories });
    expect(r.ok).toBe(true);
    const all = await store.budgets.list();
    expect(all).toHaveLength(2);
    const old = all.find((b) => b.id === original.id)!;
    const next = all.find((b) => b.id !== original.id)!;
    expect(old.amountMinor).toBe(100000);
    expect(old.closedOn).toBe("2026-10-29");
    expect(budgetStatus(old, TODAY)).toBe("closed");
    expect(next).toMatchObject({ amountMinor: 150000, effectiveFrom: TODAY, supersedesBudgetId: original.id });
    expect(budgetFor(all, { cadence: "month", date: TODAY, scope: "overall" })?.id).toBe(next.id);
    expect(budgetFor(all, { cadence: "month", date: "2026-09-15", scope: "overall" })?.id).toBe(original.id);
  });

  it("edits scheduled budgets in place", async () => {
    const future = make({ startDate: "2026-11-01" });
    await createBudget(store, future);
    await editBudget(store, future, { name: "Nov", amount: "800", endDate: "" }, { today: TODAY, budgets: [future], categories });
    const all = await store.budgets.list();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: future.id, amountMinor: 80000, name: "Nov" });
  });

  it("refuses to edit closed budgets", async () => {
    const closed = { ...make({ startDate: "2026-01-01" }), closedOn: "2026-06-30" };
    const r = await editBudget(store, closed, { name: "", amount: "1", endDate: "" }, { today: TODAY, budgets: [closed], categories });
    expect(r.ok).toBe(false);
  });

  it("ending a budget keeps the record", async () => {
    const b = make({ startDate: "2026-09-01" });
    await createBudget(store, b);
    const closed = await closeBudget(store, b, TODAY);
    expect(budgetStatus(closed, TODAY)).toBe("closed");
    expect(await store.budgets.list()).toHaveLength(1);
  });
});
