"use client";

import { useRef } from "react";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}

/** Compact tag-style toggle (e.g. week | month). Radio-group semantics with arrow keys. */
export function Segmented<T extends string>({ label, value, options, onChange, size = "sm" }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const pad = size === "sm" ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm";

  function move(index: number) {
    const next = options[(index + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    refs.current[(index + options.length) % options.length]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[var(--radius-field)] bg-[#eeeef0] p-[2px]">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i + 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i - 1);
              }
            }}
            className={`${pad} rounded-[0.55rem] font-semibold lowercase transition-colors duration-200 ${
              active ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
