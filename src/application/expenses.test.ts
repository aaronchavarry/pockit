import { beforeEach, describe, expect, it } from "vitest";
import { createIndexedDbStore, openDatabase } from "@/data/indexeddb-store";
import { createMemoryStore } from "@/data/memory-store";
import type { Store } from "@/data/repositories";
import { seedBudgets, seedCategories, seedExpenses } from "@/data/seed";
import { StaticCurrencyRateService } from "@/services/currency/currency-service";
import { createCategory, deleteCategory, validateCategoryInput } from "./categories";
import { createExpense, deleteExpense, quickAddExpense, updateExpense, validateExpenseInput, type ExpenseFormInput } from "./expenses";
import { buildDashboard, EMPTY_FILTER, filterExpenses } from "./insights";

const TODAY = "2026-10-30";
const prefs = { defaultCurrency: "EUR", locale: "en-IE", timezone: "UTC" };
const fx = new StaticCurrencyRateService();
const categories = seedCategories();

const form = (over: Partial<ExpenseFormInput> = {}): ExpenseFormInput => ({
  amount: "10",
  currency: "EUR",
  description: "Lunch",
  merchant: "",
  occurredOn: TODAY,
  occurredTime: "",
  categoryId: "cat-dining",
  recurrence: "none",
  countsTowardBudget: true,
  ...over,
});

describe("expense validation", () => {
  it("requires amount and description", () => {
    const r = validateExpenseInput(form({ amount: "", description: " " }), categories);
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["amount", "description"]);
  });
  it("rejects invalid currency, date and time", () => {
    const r = validateExpenseInput(form({ currency: "XX", occurredOn: "2026-02-30", occurredTime: "25:00" }), categories);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["currency", "occurredOn", "occurredTime"]);
  });
  it("accepts a valid form and normalizes optional fields", () => {
    const r = validateExpenseInput(form({ merchant: "  ", categoryId: "" }), categories);
    expect(r).toMatchObject({ ok: true, value: { amountMinor: 1000, merchant: null, categoryId: null, occurredTime: null } });
  });
});

describe("expense lifecycle and dashboard", () => {
  let store: Store;
  beforeEach(async () => {
    store = createMemoryStore();
    await store.categories.putMany(categories);
    await store.budgets.putMany(seedBudgets(TODAY));
  });

  async function dashboard(period: "week" | "month" = "month") {
    return buildDashboard({
      period,
      today: TODAY,
      expenses: await store.expenses.list(),
      budgets: await store.budgets.list(),
      categories: await store.categories.list(),
      currency: "EUR",
      fx,
    });
  }

  it("Home updates after create, edit and delete", async () => {
    expect((await dashboard()).spent.amountMinor).toBe(0);

    const v = validateExpenseInput(form({ amount: "40" }), categories);
    if (!v.ok) throw new Error("invalid");
    const created = await createExpense(store, v.value, { timezone: "UTC" });
    let d = await dashboard();
    expect(d.spent.amountMinor).toBe(4000);
    expect(d.budget?.budget.amountMinor).toBe(160000);
    expect(d.categories).toEqual([expect.objectContaining({ categoryId: "cat-dining", spentMinor: 4000 })]);
    expect(d.recent[0]?.id).toBe(created.id);

    await updateExpense(store, created, { ...v.value, amountMinor: 6000, categoryId: "cat-groceries" });
    d = await dashboard();
    expect(d.spent.amountMinor).toBe(6000);
    expect(d.categories[0]?.categoryId).toBe("cat-groceries");
    expect(d.budget?.remainingMinor).toBe(160000 - 6000);

    await deleteExpense(store, created.id);
    d = await dashboard();
    expect(d.spent.amountMinor).toBe(0);
    expect(d.recent).toHaveLength(0);
  });

  it("week and month use different ranges and budgets", async () => {
    await store.expenses.putMany(seedExpenses(TODAY, "UTC"));
    const week = await dashboard("week");
    const month = await dashboard("month");
    expect(week.range).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(month.range).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(week.budget?.budget.periodType).toBe("weekly");
    expect(month.budget?.budget.periodType).toBe("monthly");
    expect(week.spent.amountMinor).toBeLessThan(month.spent.amountMinor);
    const sum = month.categories.reduce((a, c) => a + c.spentMinor, 0);
    expect(sum).toBe(month.spent.amountMinor);
  });

  it("Month follows a date-range budget when there is no monthly one", () => {
    const range = {
      id: "bud-cycle", name: "Pay cycle", amountMinor: 120000, currency: "USD", scope: "overall" as const, categoryId: null,
      periodType: "fixed_range" as const, startDate: "2026-10-24", endDate: "2026-11-25", anchorDay: null,
      effectiveFrom: "2026-10-24", closedOn: null, supersedesBudgetId: null, createdAt: "", updatedAt: "",
    };
    const d = buildDashboard({ period: "month", today: TODAY, expenses: [], budgets: [range], categories, currency: "EUR", fx });
    expect(d.range).toEqual({ start: "2026-10-24", end: "2026-11-25" });
    expect(d.budget?.budget.id).toBe("bud-cycle");
    expect(buildDashboard({ period: "week", today: TODAY, expenses: [], budgets: [range], categories, currency: "EUR", fx }).budget).toBeNull();
  });

  it("expenses switched out of the budget are left out of Home figures", async () => {
    const v = validateExpenseInput(form({ amount: "300", countsTowardBudget: false }), categories);
    if (!v.ok) throw new Error("invalid");
    await createExpense(store, v.value, { timezone: "UTC" });
    const d = await dashboard();
    expect(d.spent.amountMinor).toBe(0);
    expect(d.categories).toEqual([]);
    expect(d.outsideBudgetMinor).toBe(30000);
    expect(d.budget?.spent.amountMinor).toBe(0);
    expect(d.budget?.remainingMinor).toBe(160000);
  });

  it("shows no budget (instead of wrong values) when none applies", async () => {
    const empty = createMemoryStore();
    const d = buildDashboard({ period: "week", today: TODAY, expenses: [], budgets: [], categories, currency: "EUR", fx });
    expect(d.budget).toBeNull();
    expect(await empty.expenses.list()).toEqual([]);
  });

  it("natural-language entry creates categorized expenses without network", async () => {
    const r = await quickAddExpense(store, "Yesterday I spent €24.50 at Rimi buying groceries", { preferences: prefs, today: TODAY, categories });
    expect(r).toMatchObject({
      ok: true,
      expense: { amountMinor: 2450, merchant: "Rimi", categoryId: "cat-groceries", occurredOn: "2026-10-29", source: "natural_language" },
    });
    const missing = await quickAddExpense(store, "Lunch at Vapiano", { preferences: prefs, today: TODAY, categories });
    expect(missing.ok).toBe(false);
    expect(await store.expenses.list()).toHaveLength(1);
  });

  it("low-confidence text stays Uncategorized", async () => {
    const r = await quickAddExpense(store, "Flowers 6.50", { preferences: prefs, today: TODAY, categories });
    expect(r.ok && r.expense.categoryId).toBeNull();
  });

  it("filters by text, category, currency, date and amount", async () => {
    await store.expenses.putMany(seedExpenses(TODAY, "UTC"));
    const all = await store.expenses.list();
    const ctx = { categories, currency: "EUR", fx };
    expect(filterExpenses(all, { ...EMPTY_FILTER, query: "rimi" }, ctx).every((e) => e.merchant === "Rimi")).toBe(true);
    expect(filterExpenses(all, { ...EMPTY_FILTER, categoryId: "none" }, ctx).map((e) => e.description)).toEqual(["Market flowers"]);
    expect(filterExpenses(all, { ...EMPTY_FILTER, currency: "USD" }, ctx)).toHaveLength(1);
    const ranged = filterExpenses(all, { ...EMPTY_FILTER, from: "2026-10-28", to: TODAY }, ctx);
    expect(ranged.every((e) => e.occurredOn >= "2026-10-28")).toBe(true);
    const big = filterExpenses(all, { ...EMPTY_FILTER, minMinor: 50000 }, ctx);
    expect(big.every((e) => e.description === "Rent")).toBe(true);
    const sorted = filterExpenses(all, EMPTY_FILTER, ctx);
    expect(sorted[0]!.occurredOn >= sorted[sorted.length - 1]!.occurredOn).toBe(true);
  });
});

describe("categories", () => {
  it("prevents duplicate names case-insensitively", () => {
    const r = validateCategoryInput({ name: "groceries", description: "", keywords: "", icon: "" }, categories);
    expect(!r.ok && r.errors.name).toMatch(/already exists/);
  });

  it("keywords from user categories drive categorization", async () => {
    const store = createMemoryStore();
    await store.categories.putMany(categories);
    const v = validateCategoryInput({ name: "Pets", description: "", keywords: "Zooplus, vet", icon: "🐾" }, categories);
    if (!v.ok) throw new Error("invalid");
    const pets = await createCategory(store, v.value);
    const r = await quickAddExpense(store, "Zooplus 23", { preferences: prefs, today: TODAY, categories: await store.categories.list() });
    expect(r.ok && r.expense.categoryId).toBe(pets.id);
  });

  it("deleting keeps expenses and closes category budgets", async () => {
    const store = createMemoryStore();
    await store.categories.putMany(categories);
    await store.budgets.putMany(seedBudgets(TODAY));
    await store.expenses.putMany(seedExpenses(TODAY, "UTC"));
    const before = await store.expenses.list();
    const dining = categories.find((c) => c.id === "cat-dining")!;
    const r = await deleteCategory(store, dining, { replacementId: null, expenses: before, budgets: await store.budgets.list(), today: TODAY });
    const after = await store.expenses.list();
    expect(after).toHaveLength(before.length);
    expect(after.some((e) => e.categoryId === "cat-dining")).toBe(false);
    expect(r.movedExpenses).toBeGreaterThan(0);
    expect(r.closedBudgets).toBe(1);
    expect((await store.budgets.list()).find((b) => b.id === "bud-seed-dining")?.closedOn).toBe("2026-10-29");
    expect(await store.categories.get("cat-dining")).toBeUndefined();
  });
});

describe("IndexedDB store", () => {
  it("persists across connections and clears", async () => {
    const db1 = await openDatabase();
    const s1 = createIndexedDbStore(db1);
    await s1.categories.putMany(categories);
    await s1.preferences.set(prefs);
    db1.close();

    const s2 = createIndexedDbStore(await openDatabase());
    expect(await s2.categories.list()).toHaveLength(categories.length);
    expect(await s2.preferences.get()).toEqual(prefs);
    await s2.transaction((tx) => tx.delete("categories", "cat-dining"));
    expect(await s2.categories.get("cat-dining")).toBeUndefined();
    await s2.clear();
    expect(await s2.categories.list()).toHaveLength(0);
    expect(await s2.preferences.get()).toBeUndefined();
  });
});
