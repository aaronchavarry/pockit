import type { Store } from "@/data/repositories";
import { RECURRENCES, type Category, type Expense, type ExpenseSource, type Preferences, type Recurrence } from "@/domain/types";
import { isPlainDate, type PlainDate } from "@/lib/dates";
import { newId, nowIso } from "@/lib/ids";
import { isValidCurrencyCode, parseAmount } from "@/lib/money";
import { fail, ok, type FieldErrors, type Result } from "@/lib/result";
import { categorizationService, type CategorizationResult } from "@/services/categorization/categorization-service";
import { expenseUnderstandingService } from "@/services/expense-understanding/local-parser";
import type { ExpenseDraft, MissingField } from "@/services/expense-understanding/expense-understanding-service";

/** Raw form values (strings) as typed by the user. */
export interface ExpenseFormInput {
  amount: string;
  currency: string;
  description: string;
  merchant: string;
  occurredOn: string;
  occurredTime: string;
  categoryId: string; // "" = Uncategorized
  recurrence: string;
  countsTowardBudget: boolean;
}

export type ExpenseField = keyof ExpenseFormInput;

export interface ValidExpenseFields {
  amountMinor: number;
  currency: string;
  description: string;
  merchant: string | null;
  occurredOn: PlainDate;
  occurredTime: string | null;
  categoryId: string | null;
  recurrence: Recurrence;
  countsTowardBudget: boolean;
}

const MAX_TEXT = 120;

export function validateExpenseInput(
  input: ExpenseFormInput,
  categories: readonly Category[],
): Result<ValidExpenseFields, ExpenseField> {
  const errors: FieldErrors<ExpenseField> = {};
  const currency = input.currency.trim().toUpperCase();
  if (!isValidCurrencyCode(currency)) errors.currency = "Choose a valid currency.";

  let amountMinor = 0;
  const amount = parseAmount(input.amount, isValidCurrencyCode(currency) ? currency : "EUR");
  if (amount.ok) amountMinor = amount.amountMinor;
  else errors.amount = amount.error;

  const description = input.description.trim();
  if (!description) errors.description = "Add a short description.";
  else if (description.length > MAX_TEXT) errors.description = `Keep it under ${MAX_TEXT} characters.`;

  const merchant = input.merchant.trim();
  if (merchant.length > MAX_TEXT) errors.merchant = `Keep it under ${MAX_TEXT} characters.`;

  if (!isPlainDate(input.occurredOn)) errors.occurredOn = "Pick a valid date.";

  const time = input.occurredTime.trim();
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.occurredTime = "Use a valid time (HH:MM).";

  const categoryId = input.categoryId || null;
  if (categoryId && !categories.some((c) => c.id === categoryId)) errors.categoryId = "That category no longer exists.";

  if (!RECURRENCES.includes(input.recurrence as Recurrence)) errors.recurrence = "Choose how often it repeats.";

  if (Object.keys(errors).length) return fail(errors);
  return ok({
    amountMinor,
    currency,
    description,
    merchant: merchant || null,
    occurredOn: input.occurredOn,
    occurredTime: time || null,
    categoryId,
    recurrence: input.recurrence as Recurrence,
    countsTowardBudget: input.countsTowardBudget,
  });
}

export async function createExpense(
  store: Store,
  fields: ValidExpenseFields,
  meta: { timezone: string; source?: ExpenseSource },
): Promise<Expense> {
  const ts = nowIso();
  const expense: Expense = {
    id: newId("exp"),
    ...fields,
    timezone: meta.timezone,
    source: meta.source ?? "manual",
    sourceReference: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await store.expenses.put(expense);
  return expense;
}

export async function updateExpense(store: Store, existing: Expense, fields: ValidExpenseFields): Promise<Expense> {
  const updated: Expense = { ...existing, ...fields, updatedAt: nowIso() };
  await store.expenses.put(updated);
  return updated;
}

export async function deleteExpense(store: Store, id: string): Promise<void> {
  await store.expenses.delete(id);
}

export type QuickAddResult =
  | { ok: true; expense: Expense; categorization: CategorizationResult; notes: string[] }
  | { ok: false; missing: MissingField[]; message: string };

/**
 * Natural-language entry: understand → validate → categorize → persist.
 * Creates the expense directly when amount and description are present.
 */
export async function quickAddExpense(
  store: Store,
  text: string,
  ctx: { preferences: Preferences; today: PlainDate; categories: readonly Category[] },
): Promise<QuickAddResult> {
  const understood = await expenseUnderstandingService.understand(text, {
    defaultCurrency: ctx.preferences.defaultCurrency,
    today: ctx.today,
  });
  if (!understood.ok) return understood;

  const draft: ExpenseDraft = understood.draft;
  const categorization = categorizationService.categorize(
    { description: draft.description, merchant: draft.merchant },
    ctx.categories,
  );
  const expense = await createExpense(
    store,
    { ...draft, categoryId: categorization.categoryId, countsTowardBudget: true },
    { timezone: ctx.preferences.timezone, source: "natural_language" },
  );
  return { ok: true, expense, categorization, notes: understood.notes };
}

/** Suggest a category while the user types in the manual form. */
export function suggestCategory(description: string, merchant: string, categories: readonly Category[]): string | null {
  return categorizationService.categorize({ description, merchant: merchant || null }, categories).categoryId;
}
