import { budgetFor, budgetLevel, budgetStatus, cadenceOf, periodWindow, type BudgetCadence, type BudgetLevel } from "@/domain/budget";
import type { Budget, BudgetStatus, Category, Expense } from "@/domain/types";
import { inRange, type DateRange, type PlainDate, calendarMonth, calendarWeek } from "@/lib/dates";
import { percentOf, type CurrencyCode } from "@/lib/money";
import type { CurrencyRateService } from "@/services/currency/currency-service";

/** Sorts newest first: by date, then time, then creation. */
export function sortNewestFirst(expenses: readonly Expense[]): Expense[] {
  return [...expenses].sort(
    (a, b) =>
      b.occurredOn.localeCompare(a.occurredOn) ||
      (b.occurredTime ?? "").localeCompare(a.occurredTime ?? "") ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

export interface Total {
  amountMinor: number;
  currency: CurrencyCode;
  /** Expenses that could not be converted (no rate) and are excluded. */
  unconverted: Expense[];
}

export function totalIn(expenses: readonly Expense[], currency: CurrencyCode, fx: CurrencyRateService): Total {
  let amountMinor = 0;
  const unconverted: Expense[] = [];
  for (const e of expenses) {
    const r = fx.convert(e.amountMinor, e.currency, currency, e.occurredOn);
    if (r.ok) amountMinor += r.amountMinor;
    else unconverted.push(e);
  }
  return { amountMinor, currency, unconverted };
}

export interface BudgetProgress {
  budget: Budget;
  status: BudgetStatus;
  window: DateRange | null;
  spent: Total;
  percent: number;
  remainingMinor: number; // negative = over budget
  level: BudgetLevel;
}

/**
 * Progress of `budget` for the period containing `date`. Overall budgets
 * count every expense; category budgets only their category. Category and
 * overall budgets are tracked separately and never summed together.
 */
export function budgetProgress(
  budget: Budget,
  expenses: readonly Expense[],
  ctx: { date: PlainDate; today: PlainDate; fx: CurrencyRateService },
): BudgetProgress {
  const window = periodWindow(budget, ctx.date);
  const relevant = window
    ? expenses.filter(
        (e) =>
          e.countsTowardBudget !== false &&
          inRange(e.occurredOn, window) &&
          (budget.scope === "overall" || e.categoryId === budget.categoryId),
      )
    : [];
  const spent = totalIn(relevant, budget.currency, ctx.fx);
  const percent = percentOf(spent.amountMinor, budget.amountMinor);
  return {
    budget,
    status: budgetStatus(budget, ctx.today),
    window,
    spent,
    percent,
    remainingMinor: budget.amountMinor - spent.amountMinor,
    level: budgetLevel(percent, spent.amountMinor, budget.amountMinor),
  };
}

/** Date to evaluate a budget at: today if in force, else its first/last in-force day. */
export function referenceDate(budget: Budget, today: PlainDate): PlainDate {
  const status = budgetStatus(budget, today);
  if (status === "active") return today;
  if (status === "scheduled") return budget.effectiveFrom;
  const ends = [budget.closedOn, budget.endDate].filter((d): d is PlainDate => d !== null).sort();
  const end = ends[0] ?? today;
  return end < budget.effectiveFrom ? budget.effectiveFrom : end;
}

export type HomePeriod = "week" | "month";

export interface CategorySlice {
  categoryId: string | null;
  category: Category | null;
  spentMinor: number;
  budget: BudgetProgress | null;
}

export interface Dashboard {
  period: HomePeriod;
  range: DateRange;
  currency: CurrencyCode;
  spent: Total;
  /** Expenses in the period switched out of the budget. Not part of `spent`. */
  outsideBudgetMinor: number;
  budget: BudgetProgress | null;
  categories: CategorySlice[];
  recent: Expense[];
  expenseCount: number;
}

/**
 * Home figures for the selected period. If an overall budget of the same
 * cadence is in force today, the period follows that budget's window (e.g.
 * a 15th→14th month). On Month, a date-range budget in force today stands in
 * when there is no monthly one (pay-cycle budgets like Oct 24 → Nov 25).
 * Otherwise the calendar week/month is used.
 */
export function buildDashboard(input: {
  period: HomePeriod;
  today: PlainDate;
  expenses: readonly Expense[];
  budgets: readonly Budget[];
  categories: readonly Category[];
  currency: CurrencyCode;
  fx: CurrencyRateService;
  recentLimit?: number;
}): Dashboard {
  const { period, today, fx } = input;
  const cadences: BudgetCadence[] = period === "month" ? ["month", "range"] : ["week"];
  const overall =
    cadences.map((c) => budgetFor(input.budgets, { cadence: c, date: today, scope: "overall" })).find(Boolean) ?? null;
  const range =
    (overall && periodWindow(overall, today)) || (period === "week" ? calendarWeek(today) : calendarMonth(today));

  // Expenses switched out of the budget are left out of every Home figure; only a note shows their total.
  const allInPeriod = input.expenses.filter((e) => inRange(e.occurredOn, range));
  const inPeriod = allInPeriod.filter((e) => e.countsTowardBudget !== false);
  const currency = overall?.currency ?? input.currency;
  const spent = totalIn(inPeriod, currency, fx);
  const outsideBudgetMinor = totalIn(allInPeriod.filter((e) => e.countsTowardBudget === false), currency, fx).amountMinor;
  const budget = overall ? budgetProgress(overall, input.expenses, { date: today, today, fx }) : null;

  const byCategory = new Map<string | null, Expense[]>();
  for (const e of inPeriod) {
    const key = input.categories.some((c) => c.id === e.categoryId) ? e.categoryId : null;
    byCategory.set(key, [...(byCategory.get(key) ?? []), e]);
  }
  const categories: CategorySlice[] = [...byCategory.entries()]
    .map(([categoryId, list]) => {
      const category = input.categories.find((c) => c.id === categoryId) ?? null;
      const catBudget = categoryId
        ? input.budgets.find(
            (b) =>
              b.scope === "category" &&
              b.categoryId === categoryId &&
              cadences.includes(cadenceOf(b.periodType)) &&
              budgetStatus(b, today) === "active",
          )
        : undefined;
      return {
        categoryId,
        category,
        spentMinor: totalIn(list, currency, fx).amountMinor,
        budget: catBudget ? budgetProgress(catBudget, input.expenses, { date: today, today, fx }) : null,
      };
    })
    .filter((s) => s.spentMinor > 0)
    .sort((a, b) => b.spentMinor - a.spentMinor);

  return {
    period,
    range,
    currency,
    spent,
    outsideBudgetMinor,
    budget,
    categories,
    recent: sortNewestFirst(input.expenses).slice(0, input.recentLimit ?? 10),
    expenseCount: allInPeriod.length,
  };
}

export interface ExpenseFilter {
  query: string;
  categoryId: string | "all" | "none";
  currency: string | "all";
  from: string;
  to: string;
  minMinor: number | null;
  maxMinor: number | null;
}

export const EMPTY_FILTER: ExpenseFilter = {
  query: "",
  categoryId: "all",
  currency: "all",
  from: "",
  to: "",
  minMinor: null,
  maxMinor: null,
};

/**
 * Filters expenses. Amount bounds are compared in the display currency so
 * mixed-currency lists behave predictably; unconvertible items are kept
 * only when no amount bound is set.
 */
export function filterExpenses(
  expenses: readonly Expense[],
  filter: ExpenseFilter,
  ctx: { categories: readonly Category[]; currency: CurrencyCode; fx: CurrencyRateService },
): Expense[] {
  const q = filter.query.trim().toLowerCase();
  return sortNewestFirst(
    expenses.filter((e) => {
      if (q) {
        const cat = ctx.categories.find((c) => c.id === e.categoryId)?.name ?? "";
        const hay = `${e.description} ${e.merchant ?? ""} ${cat}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter.categoryId === "none" && e.categoryId !== null && ctx.categories.some((c) => c.id === e.categoryId)) return false;
      if (filter.categoryId !== "all" && filter.categoryId !== "none" && e.categoryId !== filter.categoryId) return false;
      if (filter.currency !== "all" && e.currency !== filter.currency) return false;
      if (filter.from && e.occurredOn < filter.from) return false;
      if (filter.to && e.occurredOn > filter.to) return false;
      if (filter.minMinor !== null || filter.maxMinor !== null) {
        const r = ctx.fx.convert(e.amountMinor, e.currency, ctx.currency);
        if (!r.ok) return false;
        if (filter.minMinor !== null && r.amountMinor < filter.minMinor) return false;
        if (filter.maxMinor !== null && r.amountMinor > filter.maxMinor) return false;
      }
      return true;
    }),
  );
}
