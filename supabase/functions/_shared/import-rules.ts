/**
 * Pure helpers for turning a parsed email into an expense row. No imports, so
 * they run in Deno and Vitest alike.
 */

export interface CategoryHint {
  id: string;
  name: string;
  keywords: string[];
}

function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/**
 * Category whose name or keyword appears as whole words in the merchant.
 * Exactly one match wins; none or several → null (Uncategorized), never a guess.
 */
export function categorizeMerchant(merchant: string, categories: readonly CategoryHint[]): string | null {
  const hay = normalize(merchant);
  const matches = categories.filter((c) =>
    [c.name, ...c.keywords].some((k) => {
      const needle = normalize(k);
      return needle.trim().length >= 3 && hay.includes(needle);
    }),
  );
  return matches.length === 1 ? matches[0]!.id : null;
}

/** Calendar date and time of an instant in a time zone. */
export function localDateTime(epochMs: number, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(epochMs))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
