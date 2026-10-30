"use client";

import { useState } from "react";
import { quickAddExpense, type QuickAddResult } from "@/application/expenses";
import type { Expense } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { CheckIcon, SparkIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useReadyData } from "@/state/data-provider";
import { useFormat } from "@/state/use-format";
import { categoryLabel } from "./category-label";

const EXAMPLES = ["Coffee 4.50", "Yesterday I spent €24.50 at Rimi buying groceries", "Paid 12 USD for lunch"];

export function QuickAdd({ onDone, onEdit }: { onDone: () => void; onEdit: (e: Expense) => void }) {
  const { mutate, preferences, today, categories } = useReadyData();
  const fmt = useFormat();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuickAddResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await mutate((store) => quickAddExpense(store, text, { preferences, today, categories }));
      setResult(r);
      if (r.ok) {
        setText("");
        toast("Expense added");
      }
    } finally {
      setBusy(false);
    }
  }

  if (result?.ok) {
    const e = result.expense;
    const cat = categories.find((c) => c.id === e.categoryId) ?? null;
    return (
      <div className="flex flex-col gap-5" aria-live="polite">
        <div className="rounded-[var(--radius-card)] bg-teal-soft p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-teal-strong">
            <CheckIcon size={18} /> Added
          </p>
          <p className="mt-2 text-2xl font-medium tracking-tight tabular">{fmt.money(e.amountMinor, e.currency)}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-ink-3">For</dt>
            <dd className="text-ink">{e.description}</dd>
            {e.merchant && (
              <>
                <dt className="text-ink-3">At</dt>
                <dd className="text-ink">{e.merchant}</dd>
              </>
            )}
            <dt className="text-ink-3">When</dt>
            <dd className="text-ink">
              {fmt.day(e.occurredOn)}
              {e.occurredTime ? ` · ${e.occurredTime}` : ""}
            </dd>
            <dt className="text-ink-3">Category</dt>
            <dd className="text-ink">{categoryLabel(cat)}</dd>
            {e.recurrence !== "none" && (
              <>
                <dt className="text-ink-3">Repeats</dt>
                <dd className="text-ink capitalize">{e.recurrence}</dd>
              </>
            )}
          </dl>
          {result.notes.length > 0 && <p className="mt-3 text-xs text-ink-3">{result.notes.join(" ")}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => onEdit(e)}>
            Edit details
          </Button>
          <Button variant="secondary" onClick={() => setResult(null)}>
            Add another
          </Button>
        </div>
        <Button onClick={onDone}>Done</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <label htmlFor="quick-add" className="text-sm font-medium text-ink-2">
        What did you spend?
      </label>
      <div className="relative">
        <SparkIcon size={18} className="pointer-events-none absolute top-3.5 left-3.5 text-ink-3" />
        <input
          id="quick-add"
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (result && !result.ok) setResult(null);
          }}
          placeholder="Lunch 12.50 at Vapiano"
          aria-invalid={result && !result.ok ? true : undefined}
          aria-describedby="quick-add-help"
          className={`${controlClass} h-12 pl-10 text-base`}
        />
      </div>
      <p id="quick-add-help" className={`text-sm ${result && !result.ok ? "text-danger" : "text-ink-3"}`} role={result && !result.ok ? "alert" : undefined}>
        {result && !result.ok
          ? result.message
          : `Include an amount and what it was for. Date, place and currency are optional — default currency is ${preferences.defaultCurrency}.`}
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            className="rounded-[var(--radius-tile)] bg-muted px-3 py-1.5 text-left text-xs text-ink-2 hover:bg-muted"
          >
            {ex}
          </button>
        ))}
      </div>
      <Button type="submit" size="lg" disabled={busy || !text.trim()} className="mt-1">
        {busy ? "Adding…" : "Add expense"}
      </Button>
      <p className="text-center text-xs text-ink-3">Understood on this device — no AI service or network involved.</p>
    </form>
  );
}
