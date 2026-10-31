"use client";

import { useState } from "react";
import {
  createExpense,
  deleteExpense,
  suggestCategory,
  updateExpense,
  validateExpenseInput,
  type ExpenseField,
  type ExpenseFormInput,
} from "@/application/expenses";
import { RECURRENCES, type Expense } from "@/domain/types";
import { nowTime } from "@/lib/dates";
import { SUPPORTED_CURRENCIES, toDecimalString } from "@/lib/money";
import type { FieldErrors } from "@/lib/result";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useReadyData } from "@/state/data-provider";

const RECURRENCE_LABELS: Record<string, string> = {
  none: "Doesn’t repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function ExpenseForm({ expense, onDone }: { expense?: Expense; onDone: () => void }) {
  const { mutate, preferences, today, categories } = useReadyData();
  const toast = useToast();
  const [values, setValues] = useState<ExpenseFormInput>(() =>
    expense
      ? {
          amount: toDecimalString(expense.amountMinor, expense.currency),
          currency: expense.currency,
          description: expense.description,
          merchant: expense.merchant ?? "",
          occurredOn: expense.occurredOn,
          occurredTime: expense.occurredTime ?? "",
          categoryId: expense.categoryId && categories.some((c) => c.id === expense.categoryId) ? expense.categoryId : "",
          recurrence: expense.recurrence,
          countsTowardBudget: expense.countsTowardBudget !== false,
        }
      : {
          amount: "",
          currency: preferences.defaultCurrency,
          description: "",
          merchant: "",
          occurredOn: today,
          occurredTime: nowTime(preferences.timezone),
          categoryId: "",
          recurrence: "none",
          countsTowardBudget: true,
        },
  );
  const [categoryTouched, setCategoryTouched] = useState(Boolean(expense));
  const [errors, setErrors] = useState<FieldErrors<ExpenseField>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currencies = [...new Set([...SUPPORTED_CURRENCIES, values.currency])];

  function set<K extends Exclude<ExpenseField, "countsTowardBudget">>(key: K, value: string) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      // Suggest a category from description/merchant until the user picks one.
      if (!categoryTouched && (key === "description" || key === "merchant")) {
        next.categoryId = suggestCategory(next.description, next.merchant, categories) ?? "";
      }
      return next;
    });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validateExpenseInput(values, categories);
    if (!result.ok) {
      setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      if (first) document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (expense) {
        await mutate((store) => updateExpense(store, expense, result.value));
        toast("Expense updated");
      } else {
        await mutate((store) => createExpense(store, result.value, { timezone: preferences.timezone }));
        toast("Expense added");
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!expense || busy) return;
    setBusy(true);
    try {
      await mutate((store) => deleteExpense(store, expense.id));
      toast("Expense deleted");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Amount" error={errors.amount}>
          {(p) => (
            <Input
              {...p}
              data-field="amount"
              inputMode="decimal"
              autoComplete="off"
              autoFocus={!expense}
              placeholder="0.00"
              value={values.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="text-lg tabular"
            />
          )}
        </Field>
        <Field label="Currency" error={errors.currency}>
          {(p) => (
            <Select {...p} data-field="currency" value={values.currency} onChange={(e) => set("currency", e.target.value)}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Description" error={errors.description}>
        {(p) => (
          <Input
            {...p}
            data-field="description"
            placeholder="e.g. Groceries"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
          />
        )}
      </Field>

      <Field label="Merchant or place" optional error={errors.merchant}>
        {(p) => (
          <Input
            {...p}
            data-field="merchant"
            placeholder="e.g. Rimi"
            value={values.merchant}
            onChange={(e) => set("merchant", e.target.value)}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={errors.occurredOn}>
          {(p) => (
            <Input
              {...p}
              data-field="occurredOn"
              type="date"
              value={values.occurredOn}
              onChange={(e) => set("occurredOn", e.target.value)}
            />
          )}
        </Field>
        <Field label="Time" optional error={errors.occurredTime}>
          {(p) => (
            <Input
              {...p}
              data-field="occurredTime"
              type="time"
              value={values.occurredTime}
              onChange={(e) => set("occurredTime", e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Category"
          error={errors.categoryId}
          hint={!categoryTouched && values.categoryId ? "Suggested" : undefined}
        >
          {(p) => (
            <Select
              {...p}
              data-field="categoryId"
              value={values.categoryId}
              onChange={(e) => {
                setCategoryTouched(true);
                set("categoryId", e.target.value);
              }}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Repeats" error={errors.recurrence}>
          {(p) => (
            <Select {...p} data-field="recurrence" value={values.recurrence} onChange={(e) => set("recurrence", e.target.value)}>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-field)] bg-muted px-3.5 py-2.5">
        <span className="flex flex-col">
          <span className="text-sm font-medium text-ink">Count toward budget</span>
          <span className="text-xs text-ink-3">Turn off for one-offs like a flight.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          data-field="countsTowardBudget"
          checked={values.countsTowardBudget}
          onChange={(e) => setValues((v) => ({ ...v, countsTowardBudget: e.target.checked }))}
          className="switch"
        />
      </label>

      {expense && (
        <p className="text-xs text-ink-3">
          Added {expense.source === "natural_language" ? "from a description" : expense.source === "email" ? "from email" : "manually"}.
        </p>
      )}

      <Button type="submit" size="lg" disabled={busy} className="mt-1">
        {busy ? "Saving…" : expense ? "Save changes" : "Add expense"}
      </Button>

      {expense &&
        (confirmDelete ? (
          <div role="alertdialog" aria-label="Confirm delete" className="rounded-[var(--radius-card)] bg-danger-soft p-4">
            <p className="text-sm text-danger">Delete “{expense.description}”? This can’t be undone.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
              <Button variant="danger" disabled={busy} onClick={remove}>
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => setConfirmDelete(true)}>
            Delete expense
          </Button>
        ))}
    </form>
  );
}
