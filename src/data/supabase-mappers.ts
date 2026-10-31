import type { Budget, Category, Expense, Preferences } from "@/domain/types";
import type { Collection } from "./repositories";

/** Row shapes of the Supabase tables (snake_case, see supabase/migrations). */
export interface ExpenseRow {
  id: string;
  amount_minor: number;
  currency: string;
  description: string;
  merchant: string | null;
  category_id: string | null;
  occurred_on: string;
  occurred_time: string | null;
  timezone: string;
  recurrence: Expense["recurrence"];
  source: Expense["source"];
  source_reference: string | null;
  counts_toward_budget: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  id: string;
  name: string;
  amount_minor: number;
  currency: string;
  scope: Budget["scope"];
  category_id: string | null;
  period_type: Budget["periodType"];
  start_date: string;
  end_date: string | null;
  anchor_day: number | null;
  effective_from: string;
  closed_on: string | null;
  supersedes_budget_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  icon: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PreferencesRow {
  default_currency: string;
  locale: string;
  timezone: string;
}

export const expenseToRow = (e: Expense): ExpenseRow => ({
  id: e.id,
  amount_minor: e.amountMinor,
  currency: e.currency,
  description: e.description,
  merchant: e.merchant,
  category_id: e.categoryId,
  occurred_on: e.occurredOn,
  occurred_time: e.occurredTime,
  timezone: e.timezone,
  recurrence: e.recurrence,
  source: e.source,
  source_reference: e.sourceReference,
  counts_toward_budget: e.countsTowardBudget,
  created_at: e.createdAt,
  updated_at: e.updatedAt,
});

export const expenseFromRow = (r: ExpenseRow): Expense => ({
  id: r.id,
  amountMinor: Number(r.amount_minor),
  currency: r.currency,
  description: r.description,
  merchant: r.merchant,
  categoryId: r.category_id,
  occurredOn: r.occurred_on,
  // Postgres `time` comes back as "HH:mm:ss"; the app uses "HH:mm".
  occurredTime: r.occurred_time ? r.occurred_time.slice(0, 5) : null,
  timezone: r.timezone,
  recurrence: r.recurrence,
  source: r.source,
  sourceReference: r.source_reference,
  countsTowardBudget: r.counts_toward_budget ?? true,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const budgetToRow = (b: Budget): BudgetRow => ({
  id: b.id,
  name: b.name,
  amount_minor: b.amountMinor,
  currency: b.currency,
  scope: b.scope,
  category_id: b.categoryId,
  period_type: b.periodType,
  start_date: b.startDate,
  end_date: b.endDate,
  anchor_day: b.anchorDay,
  effective_from: b.effectiveFrom,
  closed_on: b.closedOn,
  supersedes_budget_id: b.supersedesBudgetId,
  created_at: b.createdAt,
  updated_at: b.updatedAt,
});

export const budgetFromRow = (r: BudgetRow): Budget => ({
  id: r.id,
  name: r.name,
  amountMinor: Number(r.amount_minor),
  currency: r.currency,
  scope: r.scope,
  categoryId: r.category_id,
  periodType: r.period_type,
  startDate: r.start_date,
  endDate: r.end_date,
  anchorDay: r.anchor_day,
  effectiveFrom: r.effective_from,
  closedOn: r.closed_on,
  supersedesBudgetId: r.supersedes_budget_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const categoryToRow = (c: Category): CategoryRow => ({
  id: c.id,
  name: c.name,
  description: c.description,
  keywords: c.keywords,
  icon: c.icon,
  is_system: c.isSystem,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

export const categoryFromRow = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  description: r.description,
  keywords: r.keywords ?? [],
  icon: r.icon,
  isSystem: r.is_system,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const preferencesToRow = (p: Preferences): PreferencesRow => ({
  default_currency: p.defaultCurrency,
  locale: p.locale,
  timezone: p.timezone,
});

export const preferencesFromRow = (r: PreferencesRow): Preferences => ({
  defaultCurrency: r.default_currency,
  locale: r.locale,
  timezone: r.timezone,
});

/** Maps any domain record of a collection to its table row. */
export function toRow(collection: Collection, item: { id: string }): ExpenseRow | BudgetRow | CategoryRow {
  switch (collection) {
    case "expenses":
      return expenseToRow(item as Expense);
    case "budgets":
      return budgetToRow(item as Budget);
    case "categories":
      return categoryToRow(item as Category);
  }
}
