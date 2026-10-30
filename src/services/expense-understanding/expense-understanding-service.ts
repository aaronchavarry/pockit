import type { Recurrence } from "@/domain/types";
import type { PlainDate } from "@/lib/dates";
import type { CurrencyCode } from "@/lib/money";

export interface UnderstandingContext {
  defaultCurrency: CurrencyCode;
  today: PlainDate;
}

/** Facts extracted from free text. Only what the text actually says. */
export interface ExpenseDraft {
  amountMinor: number;
  currency: CurrencyCode;
  description: string;
  merchant: string | null;
  occurredOn: PlainDate;
  occurredTime: string | null;
  recurrence: Recurrence;
}

export type MissingField = "amount" | "description";

export type UnderstandingResult =
  | { ok: true; draft: ExpenseDraft; notes: string[] }
  | { ok: false; missing: MissingField[]; message: string };

/**
 * Turns a phrase like "Paid 12 USD for lunch" into an expense draft.
 * V1 uses a deterministic local parser; a future AI adapter can implement
 * the same interface (server-side) without UI or domain changes.
 */
export interface ExpenseUnderstandingService {
  understand(text: string, ctx: UnderstandingContext): Promise<UnderstandingResult>;
}
