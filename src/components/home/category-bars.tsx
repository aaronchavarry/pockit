"use client";

import Link from "next/link";
import type { CategorySlice } from "@/application/insights";
import { categoryIcon } from "@/components/expenses/category-label";
import { EmptyState } from "@/components/ui/misc";
import type { CurrencyCode } from "@/lib/money";
import { useFormat } from "@/state/use-format";

/** Grey that deepens to near-black with how much of the budget (or of the top category) is used. */
function tone(ratio: number, over: boolean): string {
  if (over) return "var(--color-negative)";
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return `color-mix(in oklab, #0a0a0c ${pct}%, #c7c7cc)`;
}

/**
 * One rounded column per category; the fill is what has been spent,
 * deeper as it gets closer to the limit.
 * With a category budget the grey track is the full limit, otherwise the
 * fill is relative to the biggest unbudgeted category. The row scrolls
 * sideways with a hidden scrollbar and bleeds off the right edge so the
 * cut-off column hints there is more.
 */
export function CategoryBars({ slices, currency }: { slices: CategorySlice[]; currency: CurrencyCode }) {
  const fmt = useFormat();
  if (!slices.length) {
    return <EmptyState title="No spending yet" body="Expenses you add this period will show up here by category." />;
  }
  const maxUnbudgeted = Math.max(1, ...slices.filter((s) => !s.budget).map((s) => s.spentMinor));

  return (
    <div className="-mr-5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] sm:-mr-8 lg:mr-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max gap-3 py-1 pr-5 sm:pr-8 lg:pr-0" aria-label="Spending by category">
        {slices.map((s) => {
          const name = s.category?.name ?? "Uncategorized";
          const b = s.budget;
          const fill = b ? Math.min(100, b.percent) : Math.round((s.spentMinor / maxUnbudgeted) * 100);
          const over = b ? b.remainingMinor < 0 : false;
          const label = b
            ? `${name}: ${fmt.money(s.spentMinor, currency)} of ${fmt.money(b.budget.amountMinor, b.budget.currency)} budget (${b.percent}%)`
            : `${name}: ${fmt.money(s.spentMinor, currency)}, no budget`;
          return (
            <li key={s.categoryId ?? "none"} className="w-12 shrink-0">
              <Link
                href={`/expenses?category=${s.categoryId ?? "none"}`}
                aria-label={label}
                title={label}
                className="group flex w-full flex-col items-center gap-2 rounded-2xl"
              >
                <span className={`text-xs leading-none tabular ${over ? "font-semibold text-negative" : "font-medium text-ink-2"}`}>
                  {fmt.money(s.spentMinor, currency, true)}
                </span>
                <div className="relative h-40 w-full overflow-hidden rounded-[1rem] bg-muted transition-colors group-hover:bg-track">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-[1rem] transition-[height] duration-700 ease-out"
                    style={{
                      height: s.spentMinor > 0 ? `max(${fill}%, 2rem)` : 0,
                      backgroundColor: tone(fill / 100, over),
                    }}
                  />
                  {over && (
                    <span className="absolute inset-x-0 top-2 text-center text-xs font-bold text-white" aria-hidden="true">
                      !
                    </span>
                  )}
                </div>
                <span aria-hidden="true" className="text-[1.35rem] leading-none">
                  {categoryIcon(s.category)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
