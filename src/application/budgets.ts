import type { Store } from "@/data/repositories";
import { budgetStatus, findConflict, PERIOD_LABELS } from "@/domain/budget";
import type { Budget, BudgetPeriodType, BudgetScope, Category } from "@/domain/types";
import { addDays, isPlainDate, type PlainDate } from "@/lib/dates";
import { newId, nowIso } from "@/lib/ids";
import { isValidCurrencyCode, parseAmount } from "@/lib/money";
import { fail, ok, type FieldErrors, type Result } from "@/lib/result";

export interface BudgetFormInput {
  name: string;
  amount: string;
  currency: string;
  scope: BudgetScope;
  categoryId: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  anchorDay: string;
}

export type BudgetField = keyof BudgetFormInput;

const PERIOD_TYPES: readonly BudgetPeriodType[] = ["weekly", "monthly", "yearly", "custom_recurring", "fixed_range"];

function describeConflict(b: Budget, categories: readonly Category[]): string {
  const what =
    b.scope === "overall" ? "an overall" : `a ${categories.find((c) => c.id === b.categoryId)?.name ?? "category"}`;
  return `This overlaps with ${what} ${PERIOD_LABELS[b.periodType].toLowerCase()} budget (“${b.name}”). Close or edit that one first.`;
}

export function validateBudgetInput(
  input: BudgetFormInput,
  ctx: { categories: readonly Category[]; budgets: readonly Budget[] },
): Result<Budget, BudgetField> {
  const errors: FieldErrors<BudgetField> = {};
  const currency = input.currency.trim().toUpperCase();
  if (!isValidCurrencyCode(currency)) errors.currency = "Choose a valid currency.";
  const amount = parseAmount(input.amount, isValidCurrencyCode(currency) ? currency : "EUR");
  if (!amount.ok) errors.amount = amount.error;

  if (!PERIOD_TYPES.includes(input.periodType)) errors.periodType = "Choose a period.";
  if (input.scope === "category") {
    if (!input.categoryId) errors.categoryId = "Choose a category.";
    else if (!ctx.categories.some((c) => c.id === input.categoryId)) errors.categoryId = "That category no longer exists.";
  }
  if (!isPlainDate(input.startDate)) errors.startDate = "Pick a start date.";

  let endDate: PlainDate | null = null;
  if (input.periodType === "fixed_range") {
    if (!isPlainDate(input.endDate)) errors.endDate = "Pick an end date.";
    else if (isPlainDate(input.startDate) && input.endDate < input.startDate) errors.endDate = "End date must be after the start date.";
    else endDate = input.endDate;
  }

  let anchorDay: number | null = null;
  if (input.periodType === "custom_recurring") {
    const d = Number(input.anchorDay);
    if (!Number.isInteger(d) || d < 1 || d > 28) errors.anchorDay = "Pick a day between 1 and 28.";
    else anchorDay = d;
  }

  const name = input.name.trim() || defaultBudgetName(input, ctx.categories);
  if (name.length > 60) errors.name = "Keep the name under 60 characters.";

  if (Object.keys(errors).length || !amount.ok) return fail(errors);

  const ts = nowIso();
  const candidate: Budget = {
    id: newId("bud"),
    name,
    amountMinor: amount.amountMinor,
    currency,
    scope: input.scope,
    categoryId: input.scope === "category" ? input.categoryId : null,
    periodType: input.periodType,
    startDate: input.startDate,
    endDate,
    anchorDay,
    effectiveFrom: input.startDate,
    closedOn: null,
    supersedesBudgetId: null,
    createdAt: ts,
    updatedAt: ts,
  };
  const conflict = findConflict(candidate, ctx.budgets);
  if (conflict) return fail({}, describeConflict(conflict, ctx.categories));
  return ok(candidate);
}

function defaultBudgetName(input: BudgetFormInput, categories: readonly Category[]): string {
  const period = PERIOD_LABELS[input.periodType] ?? "Budget";
  if (input.scope === "category") {
    const c = categories.find((x) => x.id === input.categoryId);
    return c ? `${c.name} · ${period}` : period;
  }
  return input.periodType === "fixed_range" ? "Date range budget" : `${period} budget`;
}

export async function createBudget(store: Store, budget: Budget): Promise<Budget> {
  await store.budgets.put(budget);
  return budget;
}

export interface BudgetEditInput {
  name: string;
  amount: string;
  endDate: string; // fixed_range only
}

/**
 * Editing preserves history: if the budget has already been in force before
 * today, the old record is closed yesterday and a new version starts today.
 * Budgets that haven't started yet (or started today) are edited in place.
 */
export async function editBudget(
  store: Store,
  existing: Budget,
  input: BudgetEditInput,
  ctx: { today: PlainDate; budgets: readonly Budget[]; categories: readonly Category[] },
): Promise<Result<Budget, keyof BudgetEditInput>> {
  if (budgetStatus(existing, ctx.today) === "closed") {
    return fail({}, "Closed budgets are kept as history and can't be edited.");
  }
  const errors: FieldErrors<keyof BudgetEditInput> = {};
  const amount = parseAmount(input.amount, existing.currency);
  if (!amount.ok) errors.amount = amount.error;
  const name = input.name.trim() || existing.name;
  if (name.length > 60) errors.name = "Keep the name under 60 characters.";
  let endDate = existing.endDate;
  if (existing.periodType === "fixed_range") {
    if (!isPlainDate(input.endDate)) errors.endDate = "Pick an end date.";
    else if (input.endDate < existing.startDate) errors.endDate = "End date must be after the start date.";
    else if (input.endDate < ctx.today) errors.endDate = "End date can't be in the past.";
    else endDate = input.endDate;
  }
  if (Object.keys(errors).length || !amount.ok) return fail(errors);

  const ts = nowIso();
  const others = ctx.budgets.filter((b) => b.id !== existing.id);

  if (existing.effectiveFrom >= ctx.today) {
    const updated: Budget = { ...existing, name, amountMinor: amount.amountMinor, endDate, updatedAt: ts };
    const conflict = findConflict(updated, others);
    if (conflict) return fail({}, describeConflict(conflict, ctx.categories));
    await store.budgets.put(updated);
    return ok(updated);
  }

  const closedOld: Budget = { ...existing, closedOn: addDays(ctx.today, -1), updatedAt: ts };
  const version: Budget = {
    ...existing,
    id: newId("bud"),
    name,
    amountMinor: amount.amountMinor,
    endDate,
    effectiveFrom: ctx.today,
    closedOn: null,
    supersedesBudgetId: existing.id,
    createdAt: ts,
    updatedAt: ts,
  };
  const conflict = findConflict(version, [...others, closedOld]);
  if (conflict) return fail({}, describeConflict(conflict, ctx.categories));
  await store.transaction((tx) => {
    tx.put("budgets", closedOld);
    tx.put("budgets", version);
  });
  return ok(version);
}

/** Stops a budget from applying from today on. The record stays as history. */
export async function closeBudget(store: Store, existing: Budget, today: PlainDate): Promise<Budget> {
  const closed: Budget = { ...existing, closedOn: addDays(today, -1), updatedAt: nowIso() };
  await store.budgets.put(closed);
  return closed;
}
