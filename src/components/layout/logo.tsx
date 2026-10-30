/** Pockit mark: a flat pocket on a teal tile. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#0F766E" />
      <path d="M9 10.5h14v6.2a7 7 0 0 1-14 0z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M13 14.2h6" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-[1.15rem] font-semibold tracking-tight text-ink">Pockit</span>
    </span>
  );
}
