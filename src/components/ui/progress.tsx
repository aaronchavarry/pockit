import type { BudgetLevel } from "@/domain/budget";

const fill: Record<BudgetLevel, string> = {
  ok: "bg-positive",
  warning: "bg-orange",
  reached: "bg-orange",
  over: "bg-orange",
};

export function levelTextClass(level: BudgetLevel): string {
  return level === "ok" ? "text-positive-ink" : level === "over" ? "text-negative" : "text-orange-ink";
}

const ringStroke: Record<BudgetLevel, string> = {
  ok: "stroke-positive",
  warning: "stroke-orange",
  reached: "stroke-orange",
  over: "stroke-negative",
};

/** Small circular meter used inside tags. Decorative: pair it with visible text. */
export function ProgressRing({ percent, level, size = 16 }: { percent: number; level: BudgetLevel; size?: number }) {
  const r = 6.25;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, percent));
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="-rotate-90">
      <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2.75" className="stroke-line-strong" />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeDasharray={`${(shown / 100) * c} ${c}`}
        className={`${ringStroke[level]} transition-[stroke-dasharray] duration-700 ease-out`}
      />
    </svg>
  );
}

/** Flat horizontal bar. Over-budget shows a full bar in the accent color. */
export function ProgressBar({
  percent,
  level,
  label,
  thickness = "md",
}: {
  percent: number;
  level: BudgetLevel;
  label: string;
  thickness?: "sm" | "md";
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(percent, 100)}
      aria-valuetext={`${percent}%`}
      className={`w-full overflow-hidden rounded-full bg-track ${thickness === "sm" ? "h-1.5" : "h-2.5"}`}
    >
      <div
        className={`h-full rounded-full ${fill[level]} transition-[width] duration-700 ease-out`}
        style={{ width: `${width > 0 ? Math.max(width, 2) : 0}%` }}
      />
    </div>
  );
}
