"use client";

import Link from "next/link";
import type { Dashboard } from "@/application/insights";
import { levelTextClass, ProgressRing } from "@/components/ui/progress";
import { currencySymbol } from "@/lib/money";
import { useFormat } from "@/state/use-format";

/** Centered "spent" figure and one capsule with a ring meter, what's left and the share used. */
export function SpendSummary({ dashboard }: { dashboard: Dashboard }) {
  const fmt = useFormat();
  const { spent, outsideBudgetMinor, budget, currency, period } = dashboard;
  const symbol = currencySymbol(currency, fmt.locale);
  const cadence = period === "week" ? "weekly" : "monthly";

  return (
    <section aria-label="Spending summary" className="mt-8 flex flex-col items-center text-center lg:mt-10">
      <p className="flex items-baseline justify-center gap-x-1.5 leading-none">
        <span className="sr-only">Spent this {period}: </span>
        <span className="text-[1.6rem] font-light text-ink-4 sm:text-[1.9rem]">{symbol}</span>
        <span className="text-[3.25rem] font-normal tracking-[-0.045em] tabular text-ink sm:text-[3.75rem] lg:text-[4.25rem]">
          {fmt.number(spent.amountMinor, currency)}
        </span>
      </p>

      {budget ? (
        // One capsule: ring meter, what's left (or over), then the share of the budget.
        <p className="mt-5 inline-flex h-10 items-center gap-2.5 rounded-full bg-muted pr-4 pl-2.5 text-[0.875rem] tabular">
          <ProgressRing percent={budget.percent} level={budget.level} size={22} />
          {budget.remainingMinor >= 0 ? (
            <span className="font-semibold text-ink">{fmt.money(budget.remainingMinor, currency)} left</span>
          ) : (
            <span className="font-semibold text-negative">{fmt.money(-budget.remainingMinor, currency)} over</span>
          )}
          <span aria-hidden="true" className="h-4 w-px bg-line-strong" />
          <span className={`font-medium ${levelTextClass(budget.level)}`}>
            {budget.percent}%<span className="font-normal text-ink-3"> of {fmt.money(budget.budget.amountMinor, currency, true)}</span>
          </span>
        </p>
      ) : (
        <p className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-muted px-4 text-[0.875rem] text-ink-3">
          No {cadence} budget ·
          <Link href={`/budgets?new=${cadence}`} className="font-semibold text-ink hover:underline">
            Set one up
          </Link>
        </p>
      )}

      {budget && outsideBudgetMinor > 0 && (
        <p className="mt-3 text-xs text-ink-3">{fmt.money(outsideBudgetMinor, currency)} not counted in the budget</p>
      )}

      {spent.unconverted.length > 0 && (
        <p className="mt-3 text-xs text-orange-ink">
          {spent.unconverted.length} expense{spent.unconverted.length > 1 ? "s" : ""} in{" "}
          {[...new Set(spent.unconverted.map((e) => e.currency))].join(", ")} not included — no conversion rate available.
        </p>
      )}
    </section>
  );
}
