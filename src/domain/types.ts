import type { PlainDate } from "@/lib/dates";
import type { CurrencyCode } from "@/lib/money";

export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";
export const RECURRENCES: readonly Recurrence[] = ["none", "daily", "weekly", "monthly", "yearly"];

export type ExpenseSource = "manual" | "natural_language" | "email";

export interface Expense {
  id: string;
  amountMinor: number;
  currency: CurrencyCode;
  description: string;
  merchant: string | null;
  /** null = Uncategorized */
  categoryId: string | null;
  /** Calendar date in the user's timezone at entry time. */
  occurredOn: PlainDate;
  /** Optional local time "HH:mm". */
  occurredTime: string | null;
  /** IANA timezone the date/time were recorded in. */
  timezone: string;
  recurrence: Recurrence;
  source: ExpenseSource;
  /** Future: email message / transaction reference for dedupe. */
  sourceReference: string | null;
  /** False = shown and totalled, but not counted against budgets (e.g. a flight). */
  countsTowardBudget: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  icon: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BudgetScope = "overall" | "category";
export type BudgetPeriodType = "weekly" | "monthly" | "yearly" | "custom_recurring" | "fixed_range";
export type BudgetStatus = "scheduled" | "active" | "closed";

export interface Budget {
  id: string;
  name: string;
  amountMinor: number;
  currency: CurrencyCode;
  scope: BudgetScope;
  categoryId: string | null;
  periodType: BudgetPeriodType;
  /** Rule start: first day of the budget (fixed_range: range start). */
  startDate: PlainDate;
  /** fixed_range only: last day of the range (inclusive). Null for recurring rules. */
  endDate: PlainDate | null;
  /** custom_recurring only: day of month each period starts (1–28). */
  anchorDay: number | null;
  /**
   * First day this record is in force. Equals startDate for originals;
   * for a replacement version it is the day the edit took effect.
   */
  effectiveFrom: PlainDate;
  /** Last day this record is in force (set when closed or replaced). */
  closedOn: PlainDate | null;
  supersedesBudgetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Preferences {
  defaultCurrency: CurrencyCode;
  locale: string;
  timezone: string;
}

export interface ExchangeRate {
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  /** Decimal string, e.g. "1.0842". 1 base = rate quote. */
  rate: string;
  rateDate: PlainDate;
  source: string;
  isDemoRate: boolean;
}
