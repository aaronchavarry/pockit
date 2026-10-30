import { UNCATEGORIZED } from "@/application/categories";
import type { Category } from "@/domain/types";

export function categoryLabel(c: Category | null): string {
  return c ? `${c.icon} ${c.name}` : UNCATEGORIZED.name;
}

export function categoryIcon(c: Category | null): string {
  return c?.icon ?? UNCATEGORIZED.icon;
}
