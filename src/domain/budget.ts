import {
  addDays,
  addMonths,
  calendarMonth,
  calendarWeek,
  calendarYear,
  dayOf,
  makeDate,
  monthOf,
  yearOf,
  type DateRange,
  type PlainDate,
} from "@/lib/dates";
import type { Budget, BudgetPeriodType, BudgetStatus } from "./types";

/**
 * Budgets of the same cadence and scope may not overlap. Cadence groups
 * budgets that answer the same question ("how much this month?").
 */
export type BudgetCadence = "week" | "month" | "year" | "range";

export function cadenceOf(periodType: BudgetPeriodType): BudgetCadence {
  switch (periodType) {
    case "weekly":
      return "week";
    case "monthly":
    case "custom_recurring":
      return "month";
    case "yearly":
      return "year";
    case "fixed_range":
      return "range";
  }
}

/** Inclusive range of days during which this budget record is in force. */
export function validity(b: Budget): { start: PlainDate; end: PlainDate | null } {
  const candidates = [b.closedOn, b.endDate].filter((d): d is PlainDate => d !== null);
  const end = candidates.length ? candidates.sort()[0]! : null;
  return { start: b.effectiveFrom, end };
}

export function isInForce(b: Budget, date: PlainDate): boolean {
  const v = validity(b);
  return date >= v.start && (v.end === null || date <= v.end);
}

export function budgetStatus(b: Budget, todayDate: PlainDate): BudgetStatus {
  const v = validity(b);
  if (v.end !== null && (v.end < todayDate || v.end < v.start)) return "closed";
  if (v.start > todayDate) return "scheduled";
  return "active";
}

/** custom_recurring window: from anchorDay of one month to the day before anchorDay next month. */
function anchoredMonth(date: PlainDate, anchorDay: number): DateRange {
  const thisMonthAnchor = makeDate(yearOf(date), monthOf(date), anchorDay);
  const start = dayOf(date) >= anchorDay ? thisMonthAnchor : addMonths(thisMonthAnchor, -1, anchorDay);
  return { start, end: addDays(addMonths(start, 1, anchorDay), -1) };
}

/**
 * The spending window (period) of this budget's rule that contains `date`.
 * Does not check whether the record is in force on that date.
 */
export function periodWindow(b: Budget, date: PlainDate): DateRange | null {
  switch (b.periodType) {
    case "weekly":
      return calendarWeek(date);
    case "monthly":
      return calendarMonth(date);
    case "yearly":
      return calendarYear(date);
    case "custom_recurring":
      return anchoredMonth(date, b.anchorDay ?? 1);
    case "fixed_range":
      if (!b.endDate || date < b.startDate || date > b.endDate) return null;
      return { start: b.startDate, end: b.endDate };
  }
}

export function scopeKey(b: Pick<Budget, "scope" | "categoryId">): string {
  return b.scope === "overall" ? "overall" : `category:${b.categoryId ?? ""}`;
}

function rangesOverlap(a: { start: PlainDate; end: PlainDate | null }, b: { start: PlainDate; end: PlainDate | null }) {
  const aEndsBeforeB = a.end !== null && a.end < b.start;
  const bEndsBeforeA = b.end !== null && b.end < a.start;
  return !aEndsBeforeB && !bEndsBeforeA;
}

/** Returns an existing budget that would conflict with `candidate`, if any. */
export function findConflict(candidate: Budget, existing: readonly Budget[]): Budget | null {
  const cv = validity(candidate);
  if (cv.end !== null && cv.end < cv.start) return null;
  for (const b of existing) {
    if (b.id === candidate.id) continue;
    if (scopeKey(b) !== scopeKey(candidate)) continue;
    if (cadenceOf(b.periodType) !== cadenceOf(candidate.periodType)) continue;
    const bv = validity(b);
    if (bv.end !== null && bv.end < bv.start) continue; // empty / cancelled record
    if (rangesOverlap(cv, bv)) return b;
  }
  return null;
}

/** The budget in force on `date` for the given scope + cadence. */
export function budgetFor(
  budgets: readonly Budget[],
  opts: { cadence: BudgetCadence; date: PlainDate; scope: "overall" } | { cadence: BudgetCadence; date: PlainDate; scope: "category"; categoryId: string },
): Budget | null {
  const key = opts.scope === "overall" ? "overall" : `category:${opts.categoryId}`;
  return (
    budgets.find((b) => scopeKey(b) === key && cadenceOf(b.periodType) === opts.cadence && isInForce(b, opts.date)) ??
    null
  );
}

export type BudgetLevel = "ok" | "warning" | "reached" | "over";

/** 80% → warning, exactly 100% → reached, above → over. */
export function budgetLevel(percent: number, spentMinor: number, limitMinor: number): BudgetLevel {
  if (spentMinor > limitMinor) return "over";
  if (spentMinor === limitMinor) return "reached";
  if (percent >= 80) return "warning";
  return "ok";
}

export const PERIOD_LABELS: Record<BudgetPeriodType, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom_recurring: "Monthly (custom start)",
  fixed_range: "Date range",
};
