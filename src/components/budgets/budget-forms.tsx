"use client";

import { useState } from "react";
import {
  createBudget,
  editBudget,
  validateBudgetInput,
  type BudgetEditInput,
  type BudgetField,
  type BudgetFormInput,
} from "@/application/budgets";
import { PERIOD_LABELS } from "@/domain/budget";
import type { Budget, BudgetPeriodType } from "@/domain/types";
import { calendarMonth, calendarWeek, calendarYear, dayOf } from "@/lib/dates";
import { SUPPORTED_CURRENCIES, toDecimalString } from "@/lib/money";
import type { FieldErrors } from "@/lib/result";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useReadyData } from "@/state/data-provider";

const PERIOD_HINTS: Record<BudgetPeriodType, string> = {
  weekly: "Resets every Monday.",
  monthly: "Runs from the 1st to the last day of each month.",
  yearly: "Runs from 1 January to 31 December.",
  custom_recurring: "Monthly, starting on a day you choose (e.g. the 15th until the 14th).",
  fixed_range: "A one-off budget for specific dates, like a trip.",
};

export function NewBudgetForm({ preset, onDone }: { preset?: BudgetPeriodType; onDone: () => void }) {
  const { mutate, preferences, today, categories, budgets } = useReadyData();
  const toast = useToast();
  const [values, setValues] = useState<BudgetFormInput>(() => ({
    name: "",
    amount: "",
    currency: preferences.defaultCurrency,
    scope: "overall",
    categoryId: "",
    periodType: preset ?? "monthly",
    startDate: defaultStart(preset ?? "monthly", today),
    endDate: "",
    anchorDay: String(Math.min(dayOf(today), 28)),
  }));
  const [errors, setErrors] = useState<FieldErrors<BudgetField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends BudgetField>(key: K, value: BudgetFormInput[K]) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "periodType") next.startDate = defaultStart(value as BudgetPeriodType, today);
      return next;
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validateBudgetInput(values, { categories, budgets });
    if (!result.ok) {
      setErrors(result.errors);
      setFormError(result.message ?? null);
      return;
    }
    setBusy(true);
    try {
      await mutate((store) => createBudget(store, result.value));
      toast("Budget created");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-2">Applies to</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["overall", "All spending"],
              ["category", "One category"],
            ] as const
          ).map(([scope, label]) => (
            <label
              key={scope}
              className={`flex h-11 cursor-pointer items-center justify-center rounded-[var(--radius-field)] border text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-ink ${
                values.scope === scope ? "border-ink bg-surface text-ink" : "border-transparent bg-muted text-ink-3 hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={scope}
                checked={values.scope === scope}
                onChange={() => set("scope", scope)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {values.scope === "category" && (
        <Field label="Category" error={errors.categoryId}>
          {(p) => (
            <Select {...p} value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      <Field label="Period" hint={PERIOD_HINTS[values.periodType]} error={errors.periodType}>
        {(p) => (
          <Select {...p} value={values.periodType} onChange={(e) => set("periodType", e.target.value as BudgetPeriodType)}>
            {(Object.keys(PERIOD_LABELS) as BudgetPeriodType[]).map((t) => (
              <option key={t} value={t}>
                {PERIOD_LABELS[t]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Limit" error={errors.amount}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              placeholder="0.00"
              value={values.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="text-lg tabular"
            />
          )}
        </Field>
        <Field label="Currency" error={errors.currency}>
          {(p) => (
            <Select {...p} value={values.currency} onChange={(e) => set("currency", e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={values.periodType === "fixed_range" ? "From" : "Starts"} error={errors.startDate}>
          {(p) => <Input {...p} type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />}
        </Field>
        {values.periodType === "fixed_range" && (
          <Field label="Until" error={errors.endDate}>
            {(p) => <Input {...p} type="date" value={values.endDate} min={values.startDate} onChange={(e) => set("endDate", e.target.value)} />}
          </Field>
        )}
        {values.periodType === "custom_recurring" && (
          <Field label="Each period starts on day" error={errors.anchorDay}>
            {(p) => (
              <Input
                {...p}
                type="number"
                min={1}
                max={28}
                inputMode="numeric"
                value={values.anchorDay}
                onChange={(e) => set("anchorDay", e.target.value)}
              />
            )}
          </Field>
        )}
      </div>

      <Field label="Name" optional error={errors.name}>
        {(p) => <Input {...p} placeholder="e.g. City trip" value={values.name} onChange={(e) => set("name", e.target.value)} />}
      </Field>

      {formError && (
        <p role="alert" className="rounded-[var(--radius-field)] bg-orange-soft px-4 py-3 text-sm text-orange-ink">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Saving…" : "Create budget"}
      </Button>
    </form>
  );
}

function defaultStart(periodType: BudgetPeriodType, today: string): string {
  if (periodType === "weekly") return calendarWeek(today).start;
  if (periodType === "monthly") return calendarMonth(today).start;
  if (periodType === "yearly") return calendarYear(today).start;
  return today;
}

export function EditBudgetForm({ budget, onDone }: { budget: Budget; onDone: () => void }) {
  const { mutate, today, budgets, categories } = useReadyData();
  const toast = useToast();
  const [values, setValues] = useState<BudgetEditInput>({
    name: budget.name,
    amount: toDecimalString(budget.amountMinor, budget.currency),
    endDate: budget.endDate ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors<keyof BudgetEditInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const versions = budget.effectiveFrom < today;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await mutate((store) => editBudget(store, budget, values, { today, budgets, categories }));
      if (!result.ok) {
        setErrors(result.errors);
        setFormError(result.message ?? null);
        return;
      }
      toast(versions ? "Budget updated — previous version kept in history" : "Budget updated");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Limit" error={errors.amount}>
          {(p) => (
            <Input
              {...p}
              autoFocus
              inputMode="decimal"
              value={values.amount}
              onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
              className="text-lg tabular"
            />
          )}
        </Field>
        <Field label="Currency">{(p) => <Input {...p} value={budget.currency} disabled />}</Field>
      </div>
      {budget.periodType === "fixed_range" && (
        <Field label="Until" error={errors.endDate}>
          {(p) => (
            <Input
              {...p}
              type="date"
              min={today}
              value={values.endDate}
              onChange={(e) => setValues((v) => ({ ...v, endDate: e.target.value }))}
            />
          )}
        </Field>
      )}
      <Field label="Name" error={errors.name}>
        {(p) => <Input {...p} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />}
      </Field>
      {versions && (
        <p className="text-sm text-ink-3">
          Changes apply from today. The current version is closed and kept in your budget history.
        </p>
      )}
      {formError && (
        <p role="alert" className="rounded-[var(--radius-field)] bg-orange-soft px-4 py-3 text-sm text-orange-ink">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
