"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { EMPTY_FILTER, filterExpenses, totalIn, type ExpenseFilter } from "@/application/insights";
import { Button } from "@/components/ui/button";
import { controlClass, Field, Input, Select } from "@/components/ui/field";
import { FilterIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import type { Expense } from "@/domain/types";
import { parseAmount } from "@/lib/money";
import { currencyService } from "@/services/currency/currency-service";
import { useReadyData } from "@/state/data-provider";
import { useFormat } from "@/state/use-format";
import { useExpenseEditor } from "./expense-editor";
import { ExpenseRow } from "./expense-row";

interface FilterForm {
  query: string;
  categoryId: string;
  currency: string;
  from: string;
  to: string;
  min: string;
  max: string;
}

export function ExpensesScreen() {
  const { expenses, categories, preferences } = useReadyData();
  const editor = useExpenseEditor();
  const fmt = useFormat();
  const params = useSearchParams();
  const initialCategory = params.get("category");

  const [form, setForm] = useState<FilterForm>({
    query: "",
    categoryId: initialCategory ?? "all",
    currency: "all",
    from: "",
    to: "",
    min: "",
    max: "",
  });
  const [showFilters, setShowFilters] = useState(Boolean(initialCategory));

  const display = preferences.defaultCurrency;
  const minParsed = form.min ? parseAmount(form.min, display) : null;
  const maxParsed = form.max ? parseAmount(form.max, display) : null;

  const filter: ExpenseFilter = {
    ...EMPTY_FILTER,
    query: form.query,
    categoryId: form.categoryId,
    currency: form.currency,
    from: form.from,
    to: form.to,
    minMinor: minParsed?.ok ? minParsed.amountMinor : null,
    maxMinor: maxParsed?.ok ? maxParsed.amountMinor : null,
  };

  // Local data sets are small; filtering on each render is cheap and always fresh.
  const filtered = filterExpenses(expenses, filter, { categories, currency: display, fx: currencyService });
  const total = totalIn(filtered, display, currencyService);
  const currencies = [...new Set(expenses.map((e) => e.currency))].sort();
  const activeCount = [
    form.categoryId !== "all",
    form.currency !== "all",
    form.from,
    form.to,
    form.min,
    form.max,
  ].filter(Boolean).length;

  const groups = groupByDay(filtered);
  const set = (key: keyof FilterForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "expense" : "expenses"} · ${fmt.money(total.amountMinor, display)}${
          total.unconverted.length ? ` (+${total.unconverted.length} without rate)` : ""
        }`}
        action={
          // Below lg the bottom navigation's add pill does this job.
          <div className="hidden shrink-0 lg:block">
            <Button onClick={() => editor.openNew()}>
              <PlusIcon size={18} />
              Add expense
            </Button>
          </div>
        }
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon size={18} className="pointer-events-none absolute top-3.5 left-3.5 text-ink-3" />
          <input
            type="search"
            aria-label="Search expenses"
            placeholder="Search description, merchant, category"
            value={form.query}
            onChange={(e) => set("query", e.target.value)}
            className={`${controlClass} pl-10`}
          />
        </div>
        <Button
          variant="secondary"
          aria-expanded={showFilters}
          aria-controls="expense-filters"
          onClick={() => setShowFilters((s) => !s)}
          className="h-11 shrink-0 rounded-[var(--radius-field)]"
        >
          <FilterIcon size={18} />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-xs text-white">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div id="expense-filters" className="mt-3 grid grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Category" className="col-span-2 sm:col-span-1 lg:col-span-2">
            {(p) => (
              <Select {...p} value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="all">All categories</option>
                <option value="none">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Currency">
            {(p) => (
              <Select {...p} value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                <option value="all">All</option>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="From">{(p) => <Input {...p} type="date" value={form.from} onChange={(e) => set("from", e.target.value)} />}</Field>
          <Field label="To">{(p) => <Input {...p} type="date" value={form.to} onChange={(e) => set("to", e.target.value)} />}</Field>
          <div className="col-span-2 grid grid-cols-2 gap-3 sm:col-span-1 lg:col-span-1 lg:grid-cols-1">
            <Field label={`Min (${display})`} error={minParsed && !minParsed.ok ? minParsed.error : undefined}>
              {(p) => <Input {...p} inputMode="decimal" value={form.min} onChange={(e) => set("min", e.target.value)} />}
            </Field>
            <Field label={`Max (${display})`} error={maxParsed && !maxParsed.ok ? maxParsed.error : undefined}>
              {(p) => <Input {...p} inputMode="decimal" value={form.max} onChange={(e) => set("max", e.target.value)} />}
            </Field>
          </div>
          {activeCount > 0 && (
            <div className="col-span-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, categoryId: "all", currency: "all", from: "", to: "", min: "", max: "" }))}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        {expenses.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No expenses yet"
            body="Add one by typing a short description like “Lunch 12.50” — Pockit fills in the rest."
            action={<Button onClick={() => editor.openNew()}>Add your first expense</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" body="Try a different search or clear the filters." />
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(({ date, items }) => (
              <section key={date} aria-label={fmt.day(date)}>
                <h2 className="mb-1 flex items-baseline justify-between border-b border-line px-2 pb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
                  <span>{fmt.day(date)}</span>
                  <span className="tabular normal-case">
                    {fmt.money(totalIn(items, display, currencyService).amountMinor, display)}
                  </span>
                </h2>
                <ul>
                  {items.map((e) => (
                    <li key={e.id}>
                      <ExpenseRow expense={e} showDate={false} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function groupByDay(expenses: Expense[]): Array<{ date: string; items: Expense[] }> {
  const groups: Array<{ date: string; items: Expense[] }> = [];
  for (const e of expenses) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.occurredOn) last.items.push(e);
    else groups.push({ date: e.occurredOn, items: [e] });
  }
  return groups;
}
