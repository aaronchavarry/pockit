"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
import { IconButton } from "./button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** "sheet" docks to the bottom on small screens. */
  variant?: "sheet" | "center";
  size?: "sm" | "md";
}

/**
 * Native <dialog> modal: focus trapping, Esc to close and inert background
 * come from the platform.
 */
export function Dialog({ open, onClose, title, description, children, variant = "sheet", size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const position =
    variant === "sheet"
      ? "mb-0 mt-auto w-full max-w-none rounded-t-[1.25rem] sm:m-auto sm:rounded-[1.25rem]"
      : "m-auto w-[calc(100%-2rem)] rounded-[1.25rem]";
  const width = size === "sm" ? "sm:max-w-sm" : "sm:max-w-lg";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className={`${position} ${width} max-h-[92dvh] bg-surface p-0 text-ink shadow-none open:animate-sheet-in`}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-ink-3">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mt-1.5 -mr-2 shrink-0">
            <CloseIcon />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pt-4 pb-5 pb-safe sm:px-6 sm:pb-6">{open ? children : null}</div>
      </div>
    </dialog>
  );
}
