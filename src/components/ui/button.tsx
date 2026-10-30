import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#2a2a2e] active:bg-[#2a2a2e]",
  secondary: "bg-muted text-ink hover:bg-track",
  ghost: "text-ink-2 hover:bg-muted hover:text-ink",
  danger: "bg-danger text-white hover:bg-[#a5231a]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-[var(--radius-field)]",
  md: "h-11 px-4 text-[0.95rem] rounded-[var(--radius-field)]",
  lg: "h-12 px-6 text-base rounded-[0.875rem]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function IconButton({
  label,
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-muted hover:text-ink ${className}`}
      {...rest}
    />
  );
}
