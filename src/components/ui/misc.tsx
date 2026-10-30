import type { ReactNode } from "react";

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] bg-muted px-6 py-10 text-center">
      {icon && <div className="mb-1 text-2xl" aria-hidden="true">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-[1.25rem] font-bold tracking-[-0.02em] text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

export const cardClass = "rounded-[var(--radius-card)] border border-line bg-surface";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${cardClass} ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "teal" | "orange" | "danger" }) {
  const tones = {
    neutral: "bg-muted text-ink-2 ring-1 ring-inset ring-line",
    teal: "bg-positive-soft text-positive-ink",
    orange: "bg-orange-soft text-orange-ink",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={`inline-flex h-6 items-center rounded-md px-2 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[2rem] leading-tight font-bold tracking-[-0.03em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-20 text-sm text-ink-3">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-ink" aria-hidden="true" />
      {label}…
    </div>
  );
}
