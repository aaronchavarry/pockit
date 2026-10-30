"use client";

import type { Expense } from "@/domain/types";
import { useExpenseEditor } from "@/components/expenses/expense-editor";
import { ExpenseRow } from "@/components/expenses/expense-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export function RecentList({ expenses }: { expenses: Expense[] }) {
  const editor = useExpenseEditor();
  if (!expenses.length) {
    return (
      <EmptyState
        title="Nothing here yet"
        body="Add your first expense — just type something like “Coffee 4.50”."
        action={<Button onClick={() => editor.openNew()}>Add expense</Button>}
      />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {expenses.map((e) => (
        <li key={e.id}>
          <ExpenseRow expense={e} variant="tile" />
        </li>
      ))}
    </ul>
  );
}
