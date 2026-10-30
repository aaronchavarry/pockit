import type { Store } from "@/data/repositories";
import type { Budget, Category, Expense } from "@/domain/types";
import { addDays, type PlainDate } from "@/lib/dates";
import { newId, nowIso } from "@/lib/ids";
import { fail, ok, type FieldErrors, type Result } from "@/lib/result";

export interface CategoryFormInput {
  name: string;
  description: string;
  keywords: string; // comma-separated
  icon: string;
}

export type CategoryField = keyof CategoryFormInput;

export const UNCATEGORIZED = { name: "Uncategorized", icon: "•" } as const;

export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw.split(/[,\n]/)) {
    const v = k.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export function validateCategoryInput(
  input: CategoryFormInput,
  existing: readonly Category[],
  editingId?: string,
): Result<Pick<Category, "name" | "description" | "keywords" | "icon">, CategoryField> {
  const errors: FieldErrors<CategoryField> = {};
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Give the category a name.";
  else if (name.length > 40) errors.name = "Keep the name under 40 characters.";
  else if (name.toLowerCase() === UNCATEGORIZED.name.toLowerCase()) errors.name = "“Uncategorized” is reserved.";
  else if (existing.some((c) => c.id !== editingId && c.name.toLowerCase() === name.toLowerCase())) {
    errors.name = "A category with this name already exists.";
  }
  const description = input.description.trim();
  if (description.length > 240) errors.description = "Keep the description under 240 characters.";
  const icon = input.icon.trim();
  if ([...icon].length > 4) errors.icon = "Use a single emoji.";

  if (Object.keys(errors).length) return fail(errors);
  return ok({ name, description, keywords: parseKeywords(input.keywords), icon: icon || "🏷️" });
}

export async function createCategory(store: Store, fields: Pick<Category, "name" | "description" | "keywords" | "icon">) {
  const ts = nowIso();
  const category: Category = { id: newId("cat"), ...fields, isSystem: false, createdAt: ts, updatedAt: ts };
  await store.categories.put(category);
  return category;
}

/** Editing a category affects future categorization only; expenses keep their categoryId. */
export async function updateCategory(
  store: Store,
  existing: Category,
  fields: Pick<Category, "name" | "description" | "keywords" | "icon">,
) {
  const updated: Category = { ...existing, ...fields, updatedAt: nowIso() };
  await store.categories.put(updated);
  return updated;
}

/**
 * Deletes a category without losing expenses: they move to `replacementId`
 * (or Uncategorized). Category budgets for it are closed, not deleted.
 */
export async function deleteCategory(
  store: Store,
  category: Category,
  opts: { replacementId: string | null; expenses: readonly Expense[]; budgets: readonly Budget[]; today: PlainDate },
): Promise<{ movedExpenses: number; closedBudgets: number }> {
  const ts = nowIso();
  const moved = opts.expenses
    .filter((e) => e.categoryId === category.id)
    .map((e): Expense => ({ ...e, categoryId: opts.replacementId, updatedAt: ts }));
  const closed = opts.budgets
    .filter((b) => b.scope === "category" && b.categoryId === category.id && (b.closedOn === null || b.closedOn >= opts.today))
    .map((b): Budget => ({ ...b, closedOn: addDays(opts.today, -1), updatedAt: ts }));

  await store.transaction((tx) => {
    for (const e of moved) tx.put("expenses", e);
    for (const b of closed) tx.put("budgets", b);
    tx.delete("categories", category.id);
  });
  return { movedExpenses: moved.length, closedBudgets: closed.length };
}
