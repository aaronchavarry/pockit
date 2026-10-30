import { ImageResponse } from "next/og";

/** App icons rendered once at build time (no binary assets in the repo). */
const ICONS = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
  "apple-touch-icon.png": { size: 180, maskable: true },
} as const;

type IconName = keyof typeof ICONS;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const icon = ICONS[name as IconName];
  if (!icon) return new Response("Not found", { status: 404 });
  const { size, maskable } = icon;
  // Maskable icons keep the mark inside the 80% safe zone on a full-bleed tile.
  const markScale = maskable ? 0.62 : 0.8;
  const mark = Math.round(size * markScale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#0F766E" : "transparent",
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 32 32">
          <rect width="32" height="32" rx={maskable ? 0 : 9} fill="#0F766E" />
          <path d="M9 10.5h14v6.2a7 7 0 0 1-14 0z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M13 14.2h6" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
