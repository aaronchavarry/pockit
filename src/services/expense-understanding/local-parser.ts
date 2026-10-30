import type { Recurrence } from "@/domain/types";
import { addDays, isPlainDate, weekdayIndex, type PlainDate } from "@/lib/dates";
import { isValidCurrencyCode, parseAmount, type CurrencyCode } from "@/lib/money";
import type {
  ExpenseUnderstandingService,
  MissingField,
  UnderstandingContext,
  UnderstandingResult,
} from "./expense-understanding-service";

const SYMBOLS: Record<string, CurrencyCode> = {
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "S/": "PEN",
  "US$": "USD",
  "$": "USD",
};

const WORDS: Record<string, CurrencyCode> = {
  euro: "EUR",
  euros: "EUR",
  eur: "EUR",
  dollar: "USD",
  dollars: "USD",
  bucks: "USD",
  usd: "USD",
  pound: "GBP",
  pounds: "GBP",
  gbp: "GBP",
  yen: "JPY",
  sol: "PEN",
  soles: "PEN",
};

const NUM = String.raw`\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const SYM = String.raw`US\$|S\/|[€£¥$]`;
const CODE = String.raw`[A-Za-z]{3}`;

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const FILLER = new Set([
  "i", "i've", "ive", "we", "spent", "spend", "paid", "pay", "bought", "buy", "got", "get", "had",
  "on", "for", "a", "an", "the", "some", "just", "and", "my", "me", "of", "in", "cash", "card", "with",
]);

const RECURRENCE_PATTERNS: Array<[RegExp, Recurrence]> = [
  [/\b(every\s+day|daily)\b/i, "daily"],
  [/\b(every\s+week|weekly)\b/i, "weekly"],
  [/\b(every\s+month|monthly|per\s+month|a\s+month)\b/i, "monthly"],
  [/\b(every\s+year|yearly|annually|per\s+year|a\s+year)\b/i, "yearly"],
];

interface AmountMatch {
  amountMinor: number;
  currency: CurrencyCode;
  explicitCurrency: boolean;
  index: number;
  length: number;
}

function blank(text: string, index: number, length: number): string {
  return text.slice(0, index) + " ".repeat(length) + text.slice(index + length);
}

function findAmount(text: string, defaultCurrency: CurrencyCode): AmountMatch | "ambiguous" | null {
  const candidates: Array<{ raw: string; currency: CurrencyCode | null; index: number; length: number }> = [];

  const symBefore = new RegExp(String.raw`(${SYM})\s?(${NUM})(?![\d])`, "g");
  const after = new RegExp(String.raw`(?<![\w.,])(${NUM})\s?(${SYM}|${CODE}\b|[A-Za-z]+\b)`, "g");
  const codeBefore = new RegExp(String.raw`\b(${CODE})\s?(${NUM})(?![\d])`, "g");

  for (const m of text.matchAll(symBefore)) {
    candidates.push({ raw: m[2]!, currency: SYMBOLS[m[1]!] ?? null, index: m.index, length: m[0].length });
  }
  for (const m of text.matchAll(after)) {
    const unit = m[2]!;
    const currency = SYMBOLS[unit] ?? WORDS[unit.toLowerCase()] ?? (isCode(unit) ? unit.toUpperCase() : null);
    if (currency) candidates.push({ raw: m[1]!, currency, index: m.index, length: m[0].length });
  }
  for (const m of text.matchAll(codeBefore)) {
    if (isCode(m[1]!)) candidates.push({ raw: m[2]!, currency: m[1]!.toUpperCase(), index: m.index, length: m[0].length });
  }

  if (!candidates.length) {
    // Bare numbers: accept only a single one; several are ambiguous.
    const bare = [...text.matchAll(new RegExp(String.raw`(?<![\w.,:/-])(${NUM})(?![\w.,:/-])`, "g"))];
    if (bare.length > 1) return "ambiguous";
    const only = bare[0];
    if (!only) return null;
    candidates.push({ raw: only[1]!, currency: null, index: only.index, length: only[0].length });
  }

  const distinct = new Map(candidates.map((c) => [c.index, c]));
  if (distinct.size > 1) {
    // Overlapping matches of the same number are fine; separate amounts are not.
    const spans = [...distinct.values()].sort((a, b) => a.index - b.index);
    const first = spans[0]!;
    if (spans.some((s) => s.index >= first.index + first.length)) return "ambiguous";
  }
  const pick = candidates[0]!;
  const currency = pick.currency ?? defaultCurrency;
  const parsed = parseAmount(pick.raw, currency);
  if (!parsed.ok) return null;
  return { amountMinor: parsed.amountMinor, currency, explicitCurrency: pick.currency !== null, index: pick.index, length: pick.length };
}

function isCode(word: string): boolean {
  const upper = word.toUpperCase();
  // Only treat 3-letter words as codes when written in caps or known words.
  return /^[A-Z]{3}$/.test(word) ? isValidCurrencyCode(upper) : WORDS[word.toLowerCase()] !== undefined;
}

function findDate(text: string, today: PlainDate): { date: PlainDate; index: number; length: number } | null {
  const rules: Array<[RegExp, (m: RegExpMatchArray) => PlainDate | null]> = [
    [/\b(?:on\s+)?(\d{4}-\d{2}-\d{2})\b/i, (m) => (isPlainDate(m[1]!) ? m[1]! : null)],
    [/\bthe\s+day\s+before\s+yesterday\b/i, () => addDays(today, -2)],
    [/\byesterday\b/i, () => addDays(today, -1)],
    [/\btoday\b|\bthis\s+morning\b|\btonight\b/i, () => today],
    [/\b(\d{1,2})\s+days?\s+ago\b/i, (m) => addDays(today, -Number(m[1]))],
    [
      new RegExp(String.raw`\b(?:on\s+|last\s+)(${WEEKDAYS.join("|")})\b`, "i"),
      (m) => {
        const target = WEEKDAYS.indexOf(m[1]!.toLowerCase());
        let back = (weekdayIndex(today) - target + 7) % 7;
        if (back === 0) back = 7;
        return addDays(today, -back);
      },
    ],
  ];
  for (const [re, toDate] of rules) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      const date = toDate(m);
      if (date) return { date, index: m.index, length: m[0].length };
    }
  }
  return null;
}

function findTime(text: string): { time: string; index: number; length: number } | null {
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:at\s+)?(\d{1,2}):(\d{2})\b/i);
  if (!m || m.index === undefined) return null;
  let hour = Number(m[1] ?? m[4]);
  const minute = Number(m[2] ?? m[5] ?? 0);
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return {
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    index: m.index,
    length: m[0].length,
  };
}

function findMerchant(text: string): { merchant: string; index: number; length: number } | null {
  // "at Rimi", "from Amazon", "at Café Nero": capitalised words only.
  const m = text.match(/\b(?:at|from)\s+((?:[A-Z0-9][\p{L}\d'&.-]*)(?:\s+[A-Z][\p{L}\d'&.-]*)*)/u);
  if (!m || m.index === undefined) return null;
  const merchant = m[1]!.replace(/[.,]+$/, "");
  return { merchant, index: m.index, length: m[0].length };
}

function cleanDescription(text: string): string {
  // Prefer the object of "buying X" / "for X" / "on X" when present.
  const focus = text.match(/\b(?:buying|for|on)\s+(.+)$/i);
  const source = focus?.[1] && focus[1].trim().length > 1 ? focus[1] : text;
  const words = source
    .replace(/[,;!?]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, ""))
    .filter(Boolean);
  while (words.length && FILLER.has(words[0]!.toLowerCase())) words.shift();
  while (words.length && FILLER.has(words[words.length - 1]!.toLowerCase())) words.pop();
  const result = words.join(" ").trim();
  if (!/\p{L}/u.test(result)) return "";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function parseExpenseText(input: string, ctx: UnderstandingContext): UnderstandingResult {
  let rest = ` ${input.trim().replace(/\s+/g, " ")} `;
  const notes: string[] = [];
  if (!input.trim()) {
    return { ok: false, missing: ["amount", "description"], message: "Describe the expense, e.g. “Coffee 4.50”." };
  }

  const date = findDate(rest, ctx.today);
  if (date) rest = blank(rest, date.index, date.length);

  const time = findTime(rest);
  if (time) rest = blank(rest, time.index, time.length);

  let recurrence: Recurrence = "none";
  for (const [re, value] of RECURRENCE_PATTERNS) {
    const m = rest.match(re);
    if (m && m.index !== undefined) {
      recurrence = value;
      rest = blank(rest, m.index, m[0].length);
      break;
    }
  }

  const amount = findAmount(rest, ctx.defaultCurrency);
  if (amount && amount !== "ambiguous") rest = blank(rest, amount.index, amount.length);

  const merchant = findMerchant(rest);
  if (merchant) rest = blank(rest, merchant.index, merchant.length);

  const description = cleanDescription(rest);

  const missing: MissingField[] = [];
  if (!amount || amount === "ambiguous") missing.push("amount");
  if (!description) missing.push("description");
  if (missing.length || !amount || amount === "ambiguous") {
    const message =
      amount === "ambiguous"
        ? "I found more than one number. Which one is the amount?"
        : missing.length === 2
          ? "Add an amount and what it was for, e.g. “Lunch 12.50”."
          : missing[0] === "amount"
            ? "How much was it? Add an amount, e.g. “Lunch 12.50”."
            : "What was it for? Add a short description, e.g. “Groceries €24 at Rimi”.";
    return { ok: false, missing: missing.length ? missing : ["amount"], message };
  }

  if (!amount.explicitCurrency) notes.push(`No currency mentioned, used ${amount.currency}.`);

  return {
    ok: true,
    draft: {
      amountMinor: amount.amountMinor,
      currency: amount.currency,
      description,
      merchant: merchant?.merchant ?? null,
      occurredOn: date?.date ?? ctx.today,
      occurredTime: time?.time ?? null,
      recurrence,
    },
    notes,
  };
}

export class LocalExpenseUnderstandingService implements ExpenseUnderstandingService {
  async understand(text: string, ctx: UnderstandingContext): Promise<UnderstandingResult> {
    return parseExpenseText(text, ctx);
  }
}

export const expenseUnderstandingService: ExpenseUnderstandingService = new LocalExpenseUnderstandingService();
