"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Expense } from "@/domain/types";
import { Dialog } from "@/components/ui/dialog";
import { ExpenseForm } from "./expense-form";
import { QuickAdd } from "./quick-add";

type EditorState = { kind: "closed" } | { kind: "new"; tab: "text" | "form" } | { kind: "edit"; expense: Expense };

interface EditorApi {
  openNew: (tab?: "text" | "form") => void;
  openEdit: (expense: Expense) => void;
}

const EditorContext = createContext<EditorApi | null>(null);

/** One add/edit sheet shared by every screen. */
export function ExpenseEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState>({ kind: "closed" });
  const close = useCallback(() => setState({ kind: "closed" }), []);
  const api = useMemo<EditorApi>(
    () => ({
      openNew: (tab = "text") => setState({ kind: "new", tab }),
      openEdit: (expense) => setState({ kind: "edit", expense }),
    }),
    [],
  );

  return (
    <EditorContext.Provider value={api}>
      {children}
      <Dialog
        open={state.kind !== "closed"}
        onClose={close}
        title={state.kind === "edit" ? "Edit expense" : "Add expense"}
      >
        {state.kind === "new" && (
          <>
            <div role="tablist" aria-label="How to add" className="mb-5 grid grid-cols-2 rounded-[var(--radius-field)] bg-[#eeeef0] p-[2px]">
              {(
                [
                  ["text", "Describe it"],
                  ["form", "Fill a form"],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={state.tab === tab}
                  onClick={() => setState({ kind: "new", tab })}
                  className={`h-9 rounded-[0.5rem] text-sm font-medium transition-colors ${
                    state.tab === tab ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)]" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {state.tab === "text" ? (
              <QuickAdd onDone={close} onEdit={(expense) => setState({ kind: "edit", expense })} />
            ) : (
              <ExpenseForm onDone={close} />
            )}
          </>
        )}
        {state.kind === "edit" && <ExpenseForm key={state.expense.id} expense={state.expense} onDone={close} />}
      </Dialog>
    </EditorContext.Provider>
  );
}

export function useExpenseEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useExpenseEditor must be used inside <ExpenseEditorProvider>");
  return ctx;
}
