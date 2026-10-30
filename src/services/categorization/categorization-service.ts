import type { Category } from "@/domain/types";

export interface CategorizationInput {
  description: string;
  merchant: string | null;
}

export interface CategorizationResult {
  categoryId: string | null;
  confidence: "high" | "medium" | "none";
  reason: string;
}

/** Suggests a category. Implementations must return null when unsure. */
export interface ExpenseCategorizationService {
  categorize(input: CategorizationInput, categories: readonly Category[]): CategorizationResult;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your", "other", "things", "stuff",
  "purchases", "purchase", "payments", "payment", "items", "buying", "bought", "food",
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalizeText(text).split(" ").filter(Boolean);
}

/** Simple stem so "groceries" ~ "grocery", "coffees" ~ "coffee". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function containsPhrase(haystackTokens: string[], phrase: string): boolean {
  const needle = tokens(phrase).map(stem);
  if (!needle.length) return false;
  const hay = haystackTokens.map(stem);
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((n, j) => hay[i + j] === n)) return true;
  }
  return false;
}

/**
 * Deterministic matcher: keywords and category names are strong signals;
 * meaningful words from the category description are weak signals. Ties or
 * weak-only matches across several categories fall back to Uncategorized.
 */
export class LocalCategorizationService implements ExpenseCategorizationService {
  categorize(input: CategorizationInput, categories: readonly Category[]): CategorizationResult {
    const text = tokens([input.description, input.merchant ?? ""].join(" "));
    if (!text.length) return { categoryId: null, confidence: "none", reason: "No text to match" };

    const scored = categories.map((c) => {
      let score = 0;
      let reason = "";
      const kw = c.keywords.find((k) => containsPhrase(text, k));
      if (kw) {
        score += 10;
        reason = `Keyword “${kw}”`;
      }
      if (containsPhrase(text, c.name)) {
        score += 8;
        reason ||= `Name “${c.name}”`;
      }
      const descWords = tokens(c.description)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
        .map(stem);
      const stemmed = text.map(stem);
      const hit = descWords.find((w) => stemmed.includes(w));
      if (hit) {
        score += 3;
        reason ||= `Description mentions “${hit}”`;
      }
      return { c, score, reason };
    });

    scored.sort((a, b) => b.score - a.score);
    const [best, second] = scored;
    if (!best || best.score === 0) return { categoryId: null, confidence: "none", reason: "No match" };
    if (second && second.score === best.score) {
      return { categoryId: null, confidence: "none", reason: "Ambiguous match" };
    }
    if (best.score >= 8) return { categoryId: best.c.id, confidence: "high", reason: best.reason };
    // Description-only match: accept only if clearly ahead of the rest.
    if (!second || second.score === 0) return { categoryId: best.c.id, confidence: "medium", reason: best.reason };
    return { categoryId: null, confidence: "none", reason: "Low confidence" };
  }
}

export const categorizationService: ExpenseCategorizationService = new LocalCategorizationService();
