// Imports BCP card purchases from Gmail into expenses.
// Called hourly by pg_cron (x-cron-token header, all active connections) or by the
// signed-in user's "Sync now" (bearer token, own connection only).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { parseBcpPurchase } from "../_shared/bcp-parser.ts";
import { GoogleAuthError, gmailGet, messageBody, refreshAccessToken, type GmailMessage } from "../_shared/google.ts";
import { adminClient, corsHeaders, json, requestUserId } from "../_shared/http.ts";
import { categorizeMerchant, localDateTime, type CategoryHint } from "../_shared/import-rules.ts";

const QUERY = "from:notificaciones@notificacionesbcp.com.pe";
const TIME_ZONE = "America/Lima"; // BCP prints Peru local time
const MAX_MESSAGES = 150; // per user per run; the rest is picked up next run

type Summary = { imported: number; skipped: number; failed: number } | { error: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const db = adminClient();

  const cronToken = req.headers.get("x-cron-token");
  if (cronToken) {
    const { data: valid } = await db.rpc("gmail_cron_token_valid", { p_token: cronToken });
    if (valid !== true) return json(req, { error: "Forbidden" }, 403);
    const { data } = await db.from("gmail_connections").select("user_id").eq("status", "active");
    let imported = 0;
    for (const { user_id } of data ?? []) {
      const r = await syncUser(db, user_id as string);
      if ("imported" in r) imported += r.imported;
    }
    return json(req, { users: data?.length ?? 0, imported });
  }

  const userId = await requestUserId(req, db);
  if (!userId) return json(req, { error: "Sign in to Pockit first." }, 401);
  const result = await syncUser(db, userId);
  return json(req, result, "error" in result ? 409 : 200);
});

async function syncUser(db: SupabaseClient, userId: string): Promise<Summary> {
  const { data: conn } = await db.from("gmail_connections").select("sync_after").eq("user_id", userId).maybeSingle();
  if (!conn) return { error: "Gmail isn't connected." };

  const setStatus = (fields: Record<string, unknown>) => db.from("gmail_connections").update(fields).eq("user_id", userId);

  let access: string;
  try {
    const { data: refresh } = await db.rpc("gmail_get_refresh_token", { p_user_id: userId });
    if (typeof refresh !== "string") throw new GoogleAuthError("No stored Gmail token", true);
    access = await refreshAccessToken(refresh);
  } catch (e) {
    const revoked = e instanceof GoogleAuthError && e.revoked;
    const message = revoked ? "Google access expired. Reconnect Gmail." : "Couldn't reach Google. Will retry.";
    await setStatus(revoked ? { status: "needs_reconnect", last_error: message } : { last_error: message });
    return { error: message };
  }

  const since = new Date(conn.sync_after as string).getTime();
  const summary = { imported: 0, skipped: 0, failed: 0 };
  let newest = since;
  let oldestFailure = Infinity;

  try {
    // 1. Candidate message ids (newest first), minus the ones already handled.
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const page = await gmailGet<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(access, "messages", {
        q: `${QUERY} after:${Math.floor(since / 1000)}`,
        maxResults: "100",
        ...(pageToken ? { pageToken } : {}),
      });
      ids.push(...(page.messages ?? []).map((m) => m.id));
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < MAX_MESSAGES);

    const { data: known } = ids.length
      ? await db.from("email_imports").select("message_id").eq("user_id", userId).eq("provider", "gmail").in("message_id", ids)
      : { data: [] };
    const seen = new Set((known ?? []).map((k) => k.message_id as string));
    const todo = ids.filter((id) => !seen.has(id)).slice(0, MAX_MESSAGES).reverse(); // oldest first

    const { data: categories } = await db.from("categories").select("id, name, keywords").eq("user_id", userId);

    // 2. Parse each message; create the expense only when amount and merchant are present.
    for (const id of todo) {
      let received = since;
      try {
        const msg = await gmailGet<GmailMessage>(access, `messages/${id}`, { format: "full" });
        received = Number(msg.internalDate);
        const parsed = parseBcpPurchase(messageBody(msg.payload));
        if (!parsed.ok) {
          await logImport(db, userId, id, received, "skipped", parsed.reason, null);
          summary.skipped++;
        } else {
          const p = parsed.purchase;
          const fallback = localDateTime(received, TIME_ZONE);
          const now = new Date().toISOString();
          const expenseId = `exp_gmail_${id}`;
          const { error } = await db.from("expenses").insert({
            user_id: userId,
            id: expenseId,
            amount_minor: p.amountMinor,
            currency: p.currency,
            description: p.description,
            merchant: p.merchant,
            category_id: categorizeMerchant(p.merchant, (categories ?? []) as CategoryHint[]),
            occurred_on: p.occurredOn ?? fallback.date,
            occurred_time: p.occurredOn ? p.occurredTime : fallback.time,
            timezone: TIME_ZONE,
            recurrence: "none",
            source: "email",
            source_reference: p.operationNumber ? `bcp:${p.operationNumber}` : `gmail:${id}`,
            created_at: now,
            updated_at: now,
          });
          if (error?.code === "23505") {
            await logImport(db, userId, id, received, "skipped", "Duplicate of an expense already imported", null);
            summary.skipped++;
          } else if (error) {
            throw new Error(error.message);
          } else {
            await logImport(db, userId, id, received, "imported", null, expenseId);
            summary.imported++;
          }
        }
        newest = Math.max(newest, received);
      } catch (e) {
        if (e instanceof GoogleAuthError) throw e;
        // Not logged as handled, so it is retried next run.
        console.error("gmail-sync message failed:", e instanceof Error ? e.message : String(e));
        summary.failed++;
        oldestFailure = Math.min(oldestFailure, received);
      }
    }
  } catch (e) {
    const revoked = e instanceof GoogleAuthError && e.revoked;
    const message = revoked ? "Google access expired. Reconnect Gmail." : "Sync stopped early. Will retry.";
    await setStatus(revoked ? { status: "needs_reconnect", last_error: message } : { last_error: message });
    return { error: message };
  }

  // Move the window forward, but never past a message that failed.
  const cursor = Number.isFinite(oldestFailure) ? Math.min(newest, oldestFailure - 1000) : newest;
  await setStatus({
    last_synced_at: new Date().toISOString(),
    sync_after: new Date(Math.max(cursor, since)).toISOString(),
    last_error: summary.failed ? `${summary.failed} email(s) couldn't be read. Will retry.` : null,
  });
  return summary;
}

async function logImport(
  db: SupabaseClient,
  userId: string,
  messageId: string,
  receivedMs: number,
  status: "imported" | "skipped",
  reason: string | null,
  expenseId: string | null,
): Promise<void> {
  const { error } = await db.from("email_imports").upsert(
    {
      user_id: userId,
      provider: "gmail",
      message_id: messageId,
      status,
      skip_reason: reason,
      expense_id: expenseId,
      received_at: new Date(receivedMs).toISOString(),
    },
    { onConflict: "user_id,provider,message_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}
