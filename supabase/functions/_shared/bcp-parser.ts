/**
 * Deterministic parser for BCP credit-card purchase notifications
 * (from notificaciones@notificacionesbcp.com.pe, body "Realizaste un consumo de ...").
 * Pure TypeScript with no imports: runs in the Edge Function (Deno) and in Vitest.
 * Never guesses: when amount or merchant is missing the email is skipped.
 */

export interface ParsedCardPurchase {
  amountMinor: number;
  currency: "USD" | "PEN";
  merchant: string;
  description: string;
  /** YYYY-MM-DD in Lima time, as printed in the email. Null when the email has no date. */
  occurredOn: string | null;
  /** HH:mm (24h), or null. */
  occurredTime: string | null;
  /** BCP operation number, used for dedupe. */
  operationNumber: string | null;
  cardLast4: string | null;
}

export type ParseResult = { ok: true; purchase: ParsedCardPurchase } | { ok: false; reason: string };

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ",
};

/** Email body (plain text or HTML) → single-spaced plain text. */
export function emailToText(body: string): string {
  return body
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|td|th|li|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (m, name: string) => {
      if (ENTITIES[name]) return ENTITIES[name];
      const code = name.startsWith("#x") ? parseInt(name.slice(2), 16) : name.startsWith("#") ? parseInt(name.slice(1), 10) : NaN;
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    })
    .replace(/[ \s]+/g, " ")
    .trim();
}

/** "1,234.5" → 123450 minor units, without floating point. Null when not a positive amount. */
export function parseAmountMinor(raw: string): number | null {
  const clean = raw.replace(/,/g, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function currencyFrom(symbol: string): "USD" | "PEN" {
  return /^S\/?/i.test(symbol) ? "PEN" : "USD";
}

/** "ANTHROPIC* CLAUDE SUB" → "Anthropic Claude Sub". */
export function prettifyMerchant(merchant: string): string {
  return merchant
    .replace(/[*_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s./-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

const AMOUNT = String.raw`(S\/\.?|US\$|\$)\s*([\d.,]+\d)`;

export function parseBcpPurchase(body: string): ParseResult {
  const text = emailToText(body);

  const sentence = new RegExp(String.raw`Realizaste un consumo de\s*${AMOUNT}`, "i").exec(text);
  if (!sentence) return { ok: false, reason: "Not a card purchase notification" };

  const total = new RegExp(String.raw`Total del consumo\s*${AMOUNT}`, "i").exec(text);
  const [, symbol, rawAmount] = total ?? sentence;
  const amountMinor = parseAmountMinor(rawAmount ?? "");
  if (!amountMinor) return { ok: false, reason: "Amount not found" };

  // Prefer the "Empresa" field; fall back to "... en <MERCHANT>." in the opening sentence.
  const field = /Empresa\s+(.+?)(?:\s+(?:N[úu]mero de operaci[óo]n|Fecha y hora|Operaci[óo]n realizada)|$)/i.exec(text);
  const inSentence = /Realizaste un consumo de .+? con .+? en (.+?)\.(?:\s|$)/i.exec(text);
  const merchant = (field?.[1] ?? inSentence?.[1] ?? "").trim();
  if (!merchant) return { ok: false, reason: "Merchant not found" };
  // Card top-ups to the user's own Revolut account move money, they are not spending.
  if (/^Revolut\b/i.test(merchant)) return { ok: false, reason: "Top-up to own Revolut account (transfer, not spending)" };

  let occurredOn: string | null = null;
  let occurredTime: string | null = null;
  const date = /Fecha y hora\s+(\d{1,2}) de ([a-záéíóú]+) de (\d{4})(?:\s*-\s*(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?)?/i.exec(text);
  if (date) {
    const month = MONTHS[date[2]!.toLowerCase()];
    const day = Number(date[1]);
    if (month && day >= 1 && day <= 31) {
      occurredOn = `${date[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (date[4]) {
        let hour = Number(date[4]) % 12;
        if (date[6]!.toLowerCase() === "p") hour += 12;
        occurredTime = `${String(hour).padStart(2, "0")}:${date[5]}`;
      }
    }
  }

  const operation = /N[úu]mero de operaci[óo]n\s+(\d+)/i.exec(text);
  const card = /Tarjeta de Cr[ée]dito\s+\**(\d{4})\b/i.exec(text);

  return {
    ok: true,
    purchase: {
      amountMinor,
      currency: currencyFrom(symbol!),
      merchant,
      description: prettifyMerchant(merchant),
      occurredOn,
      occurredTime,
      operationNumber: operation?.[1] ?? null,
      cardLast4: card?.[1] ?? null,
    },
  };
}
