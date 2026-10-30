"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildDashboard, type HomePeriod } from "@/application/insights";
import { useExpenseEditor } from "@/components/expenses/expense-editor";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/ui/misc";
import { PlusIcon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";
import { formatRange } from "@/lib/dates";
import { currencyService } from "@/services/currency/currency-service";
import { useReadyData } from "@/state/data-provider";
import { CategoryBars } from "./category-bars";
import { RecentList } from "./recent-list";
import { SpendSummary } from "./spend-summary";

const PERIODS = [
  { value: "week", label: "week" },
  { value: "month", label: "month" },
] as const;

export function HomeScreen() {
  const { expenses, budgets, categories, preferences, today } = useReadyData();
  const editor = useExpenseEditor();
  const [period, setPeriod] = useState<HomePeriod>("month");

  const dashboard = useMemo(
    () =>
      buildDashboard({
        period,
        today,
        expenses,
        budgets,
        categories,
        currency: preferences.defaultCurrency,
        fx: currencyService,
      }),
    [period, today, expenses, budgets, categories, preferences.defaultCurrency],
  );

  return (
    <div className="mx-auto max-w-md lg:max-w-none">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[2rem] leading-tight font-bold tracking-[-0.03em] text-ink lg:text-[2.25rem]">Expenses</h1>
        <div className="flex items-center gap-3">
          <div className="hidden lg:block">
            <Button size="sm" onClick={() => editor.openNew()}>
              <PlusIcon size={18} /> Add expense
            </Button>
          </div>
          <Segmented label="Period" value={period} options={PERIODS} onChange={setPeriod} />
        </div>
      </header>
      <p className="mt-1 text-xs text-ink-3">{formatRange(dashboard.range, preferences.locale)}</p>

      <SpendSummary dashboard={dashboard} />

      <div className="mt-8 grid items-start gap-4 lg:mt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-5">
        <section aria-labelledby="home-categories" className="min-w-0">
          <h2 id="home-categories" className="sr-only">
            Categories
          </h2>
          <CategoryBars slices={dashboard.categories} currency={dashboard.currency} />
        </section>

        <section aria-labelledby="home-recent" className={`${cardClass} min-w-0 p-4 sm:p-5`}>
          <div className="mb-1 flex items-baseline justify-between">
            <h2 id="home-recent" className="text-[1.15rem] font-bold tracking-[-0.02em] text-ink">
              Recent
            </h2>
            {dashboard.recent.length > 0 && (
              <Link href="/expenses" className="text-[0.95rem] font-medium text-orange-ink hover:text-orange">
                See all
              </Link>
            )}
          </div>
          <RecentList expenses={dashboard.recent} />
        </section>
      </div>
    </div>
  );
}
