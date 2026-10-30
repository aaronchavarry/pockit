"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { closeBudget } from "@/application/budgets";
import { budgetProgress, referenceDate, type BudgetProgress } from "@/application/insights";
import { PERIOD_LABELS } from "@/domain/budget";
import type { Budget, BudgetPeriodType } from "@/domain/types";
import { formatRange } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PlusIcon } from "@/components/ui/icons";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { levelTextClass, ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { currencyService } from "@/services/currency/currency-service";
import { useReadyData } from "@/state/data-provider";
import { useFormat } from "@/state/use-format";
import { EditBudgetForm, NewBudgetForm } from "./budget-forms";

const VALID_PRESETS: readonly string[] = ["weekly", "monthly", "yearly", "custom_recurring", "fixed_range"];

type DialogState = { kind: "none" } | { kind: "new"; preset?: BudgetPeriodType } | { kind: "edit"; budget: Budget } | { kind: "close"; budget: Budget };

export function BudgetsScreen() {
  const { budgets, expenses, today } = useReadyData();
  const params = useSearchParams();
  const router = useRouter();
  const preset = params.get("new");
  const [dialog, setDialog] = useState<DialogState>(() =>
    preset && VALID_PRESETS.includes(preset) ? { kind: "new", preset: preset as BudgetPeriodType } : { kind: "none" },
  );
  const [showHistory, setShowHistory] = useState(false);

  const progress = budgets.map((b) => budgetProgress(b, expenses, { date: referenceDate(b, today), today, fx: currencyService }));
  const order = (p: BudgetProgress) => ["weekly", "monthly", "custom_recurring", "yearly", "fixed_range"].indexOf(p.budget.periodType);
  const active = progress.filter((p) => p.status === "active").sort((a, b) => order(a) - order(b));
  const overall = active.filter((p) => p.budget.scope === "overall");
  const byCategory = active.filter((p) => p.budget.scope === "category");
  const scheduled = progress.filter((p) => p.status === "scheduled").sort((a, b) => a.budget.effectiveFrom.localeCompare(b.budget.effectiveFrom));
  const history = progress
    .filter((p) => p.status === "closed")
    .sort((a, b) => b.budget.updatedAt.localeCompare(a.budget.updatedAt));

  function closeDialog() {
    setDialog({ kind: "none" });
    if (preset) router.replace("/budgets");
  }

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Spending limits — not account balances."
        action={
          <Button onClick={() => setDialog({ kind: "new" })} className="shrink-0">
            <PlusIcon size={18} />
            <span className="hidden sm:inline">New budget</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />

      {budgets.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No budgets yet"
          body="Set a weekly or monthly limit and Pockit will track how much is left."
          action={<Button onClick={() => setDialog({ kind: "new" })}>Create a budget</Button>}
        />
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <SectionTitle>Overall</SectionTitle>
            {overall.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {overall.map((p) => (
                  <BudgetCard key={p.budget.id} progress={p} onEdit={() => setDialog({ kind: "edit", budget: p.budget })} onClose={() => setDialog({ kind: "close", budget: p.budget })} />
                ))}
              </div>
            ) : (
              <EmptyState title="No overall budget running" body="Add one to see progress on Home." />
            )}
          </section>

          {byCategory.length > 0 && (
            <section>
              <SectionTitle>By category</SectionTitle>
              <div className="grid gap-3 md:grid-cols-2">
                {byCategory.map((p) => (
                  <BudgetCard key={p.budget.id} progress={p} onEdit={() => setDialog({ kind: "edit", budget: p.budget })} onClose={() => setDialog({ kind: "close", budget: p.budget })} />
                ))}
              </div>
            </section>
          )}

          {scheduled.length > 0 && (
            <section>
              <SectionTitle>Scheduled</SectionTitle>
              <div className="grid gap-3 md:grid-cols-2">
                {scheduled.map((p) => (
                  <BudgetCard key={p.budget.id} progress={p} onEdit={() => setDialog({ kind: "edit", budget: p.budget })} onClose={() => setDialog({ kind: "close", budget: p.budget })} />
                ))}
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <SectionTitle
                action={
                  <Button variant="ghost" size="sm" aria-expanded={showHistory} onClick={() => setShowHistory((s) => !s)}>
                    {showHistory ? "Hide" : `Show ${history.length}`}
                  </Button>
                }
              >
                History
              </SectionTitle>
              {showHistory && (
                <div className="grid gap-3 md:grid-cols-2">
                  {history.map((p) => (
                    <BudgetCard key={p.budget.id} progress={p} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <Dialog
        open={dialog.kind === "new" || dialog.kind === "edit"}
        onClose={closeDialog}
        title={dialog.kind === "edit" ? "Edit budget" : "New budget"}
      >
        {dialog.kind === "new" && <NewBudgetForm preset={dialog.preset} onDone={closeDialog} />}
        {dialog.kind === "edit" && <EditBudgetForm budget={dialog.budget} onDone={closeDialog} />}
      </Dialog>

      <CloseBudgetDialog budget={dialog.kind === "close" ? dialog.budget : null} onClose={closeDialog} />
    </div>
  );
}

function BudgetCard({ progress, onEdit, onClose }: { progress: BudgetProgress; onEdit?: () => void; onClose?: () => void }) {
  const { categories, budgets } = useReadyData();
  const fmt = useFormat();
  const { budget, status, window, spent, percent, remainingMinor, level } = progress;
  const category = budget.categoryId ? categories.find((c) => c.id === budget.categoryId) : null;
  const replacedBy = budgets.find((b) => b.supersedesBudgetId === budget.id);
  const validTo = [budget.closedOn, budget.endDate].filter(Boolean).sort()[0];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-medium text-ink">
            {category && <span aria-hidden="true">{category.icon}</span>}
            <span className="truncate">{budget.name}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            {PERIOD_LABELS[budget.periodType]}
            {budget.periodType === "custom_recurring" && budget.anchorDay ? ` · from day ${budget.anchorDay}` : ""}
            {budget.scope === "category" && !category ? " · deleted category" : ""}
          </p>
        </div>
        <StatusBadge status={status} level={level} />
      </div>

      <p className="mt-4 flex items-baseline gap-1 tabular">
        <span className="text-2xl font-medium tracking-tight">{fmt.money(spent.amountMinor, budget.currency)}</span>
        <span className="text-sm text-ink-3">/ {fmt.money(budget.amountMinor, budget.currency, true)}</span>
      </p>
      <div className="mt-3">
        <ProgressBar percent={percent} level={status === "closed" ? "ok" : level} label={`${budget.name}: ${percent}% used`} thickness="sm" />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs">
        <span className={`font-medium ${status === "closed" ? "text-ink-3" : levelTextClass(level)}`}>{percent}%</span>
        <span className="text-ink-3 tabular">
          {remainingMinor >= 0
            ? `${fmt.money(remainingMinor, budget.currency)} left`
            : `${fmt.money(-remainingMinor, budget.currency)} over`}
        </span>
      </div>

      <p className="mt-3 text-xs text-ink-3">
        {window ? `${status === "active" ? "This period" : "Period"}: ${formatRange(window, fmt.locale)}` : "No period in range"}
        {status === "scheduled" && ` · starts ${fmt.date(budget.effectiveFrom, { day: "numeric", month: "short", year: "numeric" })}`}
        {status === "closed" &&
          validTo &&
          (validTo < budget.effectiveFrom
            ? " · cancelled before it started"
            : ` · in force ${fmt.date(budget.effectiveFrom, { day: "numeric", month: "short", year: "numeric" })} – ${fmt.date(validTo, { day: "numeric", month: "short", year: "numeric" })}`)}
        {replacedBy && " · replaced by a newer version"}
      </p>
      {spent.unconverted.length > 0 && (
        <p className="mt-1 text-xs text-orange-ink">{spent.unconverted.length} expense(s) without a conversion rate not counted.</p>
      )}

      {(onEdit || onClose) && status !== "closed" && (
        <div className="mt-4 flex gap-2 border-t border-line pt-3">
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              {status === "scheduled" ? "Cancel" : "End budget"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function StatusBadge({ status, level }: { status: BudgetProgress["status"]; level: BudgetProgress["level"] }) {
  if (status === "scheduled") return <Badge>Scheduled</Badge>;
  if (status === "closed") return <Badge>Closed</Badge>;
  if (level === "over") return <Badge tone="orange">Over budget</Badge>;
  if (level === "reached") return <Badge tone="orange">Limit reached</Badge>;
  if (level === "warning") return <Badge tone="orange">Over 80%</Badge>;
  return <Badge tone="teal">On track</Badge>;
}

function CloseBudgetDialog({ budget, onClose }: { budget: Budget | null; onClose: () => void }) {
  const { mutate, today } = useReadyData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={budget !== null}
      onClose={onClose}
      title={budget && budget.effectiveFrom > today ? "Cancel this budget?" : "End this budget?"}
      description="It stops applying from today. Its record and past progress stay in your history."
      variant="center"
      size="sm"
    >
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button variant="secondary" onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            if (!budget) return;
            setBusy(true);
            try {
              await mutate((store) => closeBudget(store, budget, today));
              toast("Budget ended");
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          End budget
        </Button>
      </div>
    </Dialog>
  );
}
