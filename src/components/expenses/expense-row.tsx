"use client";

import type { Expense } from "@/domain/types";
import { RepeatIcon } from "@/components/ui/icons";
import { currencyService } from "@/services/currency/currency-service";
import { useReadyData } from "@/state/data-provider";
import { useFormat } from "@/state/use-format";
import { categoryIcon } from "./category-label";
import { useExpenseEditor } from "./expense-editor";

/** One expense; opens the editor on click. "tile" matches the Home reference's grey rows. */
export function ExpenseRow({
  expense,
  variant = "row",
  showDate = true,
}: {
  expense: Expense;
  variant?: "row" | "tile";
  showDate?: boolean;
}) {
  const { categories, preferences } = useReadyData();
  const editor = useExpenseEditor();
  const fmt = useFormat();
  const category = categories.find((c) => c.id === expense.categoryId) ?? null;
  const foreign = expense.currency !== preferences.defaultCurrency;
  const converted = foreign ? currencyService.convert(expense.amountMinor, expense.currency, preferences.defaultCurrency) : null;

  const meta = [expense.merchant, showDate ? fmt.day(expense.occurredOn) : null, expense.occurredTime].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => editor.openEdit(expense)}
      className={`flex w-full items-center gap-3 text-left transition-colors hover:bg-muted ${
        variant === "tile" ? "-mx-2 w-[calc(100%+1rem)] rounded-[var(--radius-field)] px-2 py-2.5" : "rounded-[var(--radius-field)] px-2 py-2.5"
      }`}
      aria-label={`${expense.description}, ${fmt.money(expense.amountMinor, expense.currency)}, ${[meta, showDate ? "" : fmt.day(expense.occurredOn)].filter(Boolean).join(", ")}. Edit`}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-tile)] bg-muted text-[1.05rem]"
      >
        {categoryIcon(category)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[0.95rem] font-medium text-ink">
          <span className="truncate">{expense.description}</span>
          {expense.recurrence !== "none" && <RepeatIcon size={14} className="shrink-0 text-ink-3" />}
        </span>
        <span className="block truncate text-xs text-ink-3">{meta}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[0.95rem] font-semibold tabular text-ink">{fmt.money(expense.amountMinor, expense.currency)}</span>
        {foreign && (
          <span className="block text-xs text-ink-3 tabular">
            {converted?.ok ? `≈ ${fmt.money(converted.amountMinor, preferences.defaultCurrency)}` : "No rate"}
          </span>
        )}
      </span>
    </button>
  );
}
