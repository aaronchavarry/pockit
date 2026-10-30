"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  validateCategoryInput,
  type CategoryField,
  type CategoryFormInput,
} from "@/application/categories";
import { budgetProgress, totalIn } from "@/application/insights";
import { budgetStatus } from "@/domain/budget";
import type { Category } from "@/domain/types";
import { calendarMonth, inRange } from "@/lib/dates";
import type { FieldErrors } from "@/lib/result";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { levelTextClass, ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { currencyService } from "@/services/currency/currency-service";
import { useReadyData } from "@/state/data-provider";
import { useFormat } from "@/state/use-format";

const ICONS = ["🛒", "🍔", "☕", "🚌", "🛍️", "💡", "🎬", "💊", "🏠", "✈️", "🎁", "📚", "🐾", "👶", "💼", "🏋️"];

type DialogState = { kind: "none" } | { kind: "new" } | { kind: "edit"; category: Category } | { kind: "delete"; category: Category };

export function CategoriesScreen() {
  const { categories, expenses, budgets, preferences, today } = useReadyData();
  const fmt = useFormat();
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const close = () => setDialog({ kind: "none" });

  const month = calendarMonth(today);
  const display = preferences.defaultCurrency;
  const uncategorized = expenses.filter((e) => !e.categoryId || !categories.some((c) => c.id === e.categoryId));

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Descriptions and keywords help Pockit sort new expenses for you."
        action={
          <Button onClick={() => setDialog({ kind: "new" })} className="shrink-0">
            <PlusIcon size={18} />
            <span className="hidden sm:inline">New category</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="No categories"
          body="Create categories so expenses can be grouped and budgeted."
          action={<Button onClick={() => setDialog({ kind: "new" })}>Create a category</Button>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {categories.map((c) => {
            const mine = expenses.filter((e) => e.categoryId === c.id);
            const thisMonth = totalIn(mine.filter((e) => inRange(e.occurredOn, month)), display, currencyService);
            const budget = budgets.find((b) => b.scope === "category" && b.categoryId === c.id && budgetStatus(b, today) === "active");
            const progress = budget ? budgetProgress(budget, expenses, { date: today, today, fx: currencyService }) : null;
            return (
              <li key={c.id}>
                <Card className="flex h-full flex-col p-4 sm:p-5">
                  <div className="flex items-start gap-3.5">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-tile)] bg-muted text-lg">
                      {c.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className="truncate font-medium text-ink">{c.name}</h2>
                        <span className="shrink-0 text-sm font-medium tabular text-ink">{fmt.money(thisMonth.amountMinor, display)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-3">
                        This month · {mine.length} {mine.length === 1 ? "expense" : "expenses"} total
                      </p>
                    </div>
                  </div>
                  {c.description && <p className="mt-3 text-sm text-ink-2">{c.description}</p>}
                  {c.keywords.length > 0 && (
                    <ul aria-label="Keywords" className="mt-3 flex flex-wrap gap-1.5">
                      {c.keywords.map((k) => (
                        <li key={k} className="rounded-md bg-muted px-2 py-1 text-xs text-ink-2">
                          {k}
                        </li>
                      ))}
                    </ul>
                  )}
                  {progress && (
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className="text-ink-3">{progress.budget.name}</span>
                        <span className={`font-medium tabular ${levelTextClass(progress.level)}`}>
                          {fmt.money(progress.spent.amountMinor, progress.budget.currency, true)} / {fmt.money(progress.budget.amountMinor, progress.budget.currency, true)}
                        </span>
                      </div>
                      <ProgressBar percent={progress.percent} level={progress.level} label={`${c.name} budget: ${progress.percent}% used`} thickness="sm" />
                    </div>
                  )}
                  <div className="mt-auto flex gap-2 pt-4">
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "edit", category: c })}>
                      Edit
                    </Button>
                    <Link href={`/expenses?category=${c.id}`} className="inline-flex h-9 items-center rounded-[var(--radius-field)] px-3 text-sm font-medium text-ink-2 hover:bg-muted hover:text-ink">
                      View expenses
                    </Link>
                    <Button variant="ghost" size="sm" className="ml-auto text-danger hover:text-danger" onClick={() => setDialog({ kind: "delete", category: c })}>
                      Delete
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
          <li>
            <Card className="flex h-full items-center gap-3.5 bg-muted p-4 sm:p-5">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-tile)] bg-muted text-lg">
                •
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium text-ink">Uncategorized</h2>
                <p className="text-xs text-ink-3">Expenses Pockit couldn’t confidently sort. Always available.</p>
              </div>
              <Link href="/expenses?category=none" className="shrink-0 text-sm font-medium text-ink-2 hover:text-ink">
                {uncategorized.length} {uncategorized.length === 1 ? "expense" : "expenses"}
              </Link>
            </Card>
          </li>
        </ul>
      )}

      <Dialog open={dialog.kind === "new" || dialog.kind === "edit"} onClose={close} title={dialog.kind === "edit" ? "Edit category" : "New category"}>
        {(dialog.kind === "new" || dialog.kind === "edit") && (
          <CategoryForm key={dialog.kind === "edit" ? dialog.category.id : "new"} category={dialog.kind === "edit" ? dialog.category : undefined} onDone={close} />
        )}
      </Dialog>
      <DeleteCategoryDialog category={dialog.kind === "delete" ? dialog.category : null} onClose={close} />
    </div>
  );
}

function CategoryForm({ category, onDone }: { category?: Category; onDone: () => void }) {
  const { mutate, categories } = useReadyData();
  const toast = useToast();
  const [values, setValues] = useState<CategoryFormInput>({
    name: category?.name ?? "",
    description: category?.description ?? "",
    keywords: category?.keywords.join(", ") ?? "",
    icon: category?.icon ?? "🏷️",
  });
  const [errors, setErrors] = useState<FieldErrors<CategoryField>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: CategoryField, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validateCategoryInput(values, categories, category?.id);
    if (!result.ok) return setErrors(result.errors);
    setBusy(true);
    try {
      if (category) {
        await mutate((store) => updateCategory(store, category, result.value));
        toast("Category updated");
      } else {
        await mutate((store) => createCategory(store, result.value));
        toast("Category created");
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <Field label="Icon" error={errors.icon}>
          {(p) => <Input {...p} value={values.icon} onChange={(e) => set("icon", e.target.value)} className="text-center text-xl" maxLength={8} />}
        </Field>
        <Field label="Name" error={errors.name}>
          {(p) => <Input {...p} autoFocus={!category} placeholder="e.g. Pets" value={values.name} onChange={(e) => set("name", e.target.value)} />}
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick an icon">
        {ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            aria-label={`Use ${icon}`}
            aria-pressed={values.icon === icon}
            onClick={() => set("icon", icon)}
            className={`h-9 w-9 rounded-[var(--radius-tile)] text-lg ${values.icon === icon ? "bg-muted ring-1 ring-ink" : "hover:bg-muted"}`}
          >
            {icon}
          </button>
        ))}
      </div>
      <Field label="What belongs here" optional error={errors.description} hint="Used to sort new expenses automatically.">
        {(p) => <Textarea {...p} rows={2} placeholder="e.g. Pet food, vet visits and toys." value={values.description} onChange={(e) => set("description", e.target.value)} />}
      </Field>
      <Field label="Keywords" optional hint="Comma-separated: shop names or words, e.g. Rimi, Lidl, groceries.">
        {(p) => <Input {...p} value={values.keywords} onChange={(e) => set("keywords", e.target.value)} />}
      </Field>
      {category && <p className="text-xs text-ink-3">Changes affect how new expenses are sorted. Existing expenses keep their category.</p>}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Saving…" : category ? "Save changes" : "Create category"}
      </Button>
    </form>
  );
}

function DeleteCategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { mutate, categories, expenses, budgets, today } = useReadyData();
  const toast = useToast();
  const [replacementId, setReplacementId] = useState("");
  const [busy, setBusy] = useState(false);
  const count = category ? expenses.filter((e) => e.categoryId === category.id).length : 0;

  return (
    <Dialog open={category !== null} onClose={onClose} title={`Delete “${category?.name ?? ""}”?`} size="sm" variant="center">
      <div className="flex flex-col gap-4 pt-1">
        <p className="text-sm text-ink-2">
          {count > 0
            ? `${count} ${count === 1 ? "expense uses" : "expenses use"} this category. They won’t be deleted — choose where they should go.`
            : "No expenses use this category."}{" "}
          Any budget for this category will end today.
        </p>
        {count > 0 && (
          <Field label="Move expenses to">
            {(p) => (
              <Select {...p} value={replacementId} onChange={(e) => setReplacementId(e.target.value)}>
                <option value="">Uncategorized</option>
                {categories
                  .filter((c) => c.id !== category?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!category) return;
              setBusy(true);
              try {
                const r = await mutate((store) => deleteCategory(store, category, { replacementId: replacementId || null, expenses, budgets, today }));
                toast(r.movedExpenses ? `Category deleted · ${r.movedExpenses} expenses moved` : "Category deleted");
                setReplacementId("");
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
