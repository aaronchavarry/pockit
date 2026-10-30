import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabase } from "@/data/supabase-client";

/**
 * Client side of the Gmail import (EmailTransactionSource). The Google token and
 * the parsing live server-side in the gmail-* Edge Functions; the browser only
 * starts the connection, triggers a sync and reads status and the import log.
 */

export type GmailConnection =
  | { connected: false }
  | {
      connected: true;
      email: string;
      needsReconnect: boolean;
      lastSyncedAt: string | null;
      lastError: string | null;
    };

export interface ImportLogEntry {
  messageId: string;
  status: "imported" | "skipped" | "failed";
  reason: string | null;
  receivedAt: string | null;
}

export interface SyncSummary {
  imported: number;
  skipped: number;
  failed: number;
}

function client() {
  const db = getSupabase();
  if (!db) throw new Error("Accounts aren't available in this build.");
  return db;
}

/** Error message from a failed Edge Function call (its JSON `error`), or a generic one. */
async function functionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => null)) as { error?: string } | null;
    if (body?.error) return body.error;
  }
  return "Couldn't reach Pockit's server. Check your connection.";
}

export async function loadGmail(): Promise<{ connection: GmailConnection; recent: ImportLogEntry[] }> {
  const db = client();
  const [conn, log] = await Promise.all([
    db.from("gmail_connections").select("google_email, status, last_synced_at, last_error").maybeSingle(),
    db.from("email_imports").select("message_id, status, skip_reason, received_at").order("processed_at", { ascending: false }).limit(5),
  ]);
  if (conn.error) throw new Error(conn.error.message);
  const c = conn.data;
  return {
    connection: c
      ? {
          connected: true,
          email: c.google_email,
          needsReconnect: c.status === "needs_reconnect",
          lastSyncedAt: c.last_synced_at,
          lastError: c.last_error,
        }
      : { connected: false },
    recent: (log.data ?? []).map((r) => ({
      messageId: r.message_id,
      status: r.status,
      reason: r.skip_reason,
      receivedAt: r.received_at,
    })),
  };
}

/** Sends the browser to Google's consent screen. Resolves with an error message if it can't. */
export async function startGmailConnect(): Promise<string | null> {
  const { data, error } = await client().functions.invoke<{ url: string }>("gmail-connect", {
    body: { returnTo: window.location.origin },
  });
  if (error || !data?.url) return functionError(error);
  window.location.assign(data.url);
  return null;
}

export async function syncGmailNow(): Promise<SyncSummary> {
  const { data, error } = await client().functions.invoke<SyncSummary>("gmail-sync", { body: {} });
  if (error || !data) throw new Error(await functionError(error));
  return data;
}

export async function disconnectGmail(): Promise<void> {
  const { error } = await client().rpc("gmail_disconnect");
  if (error) throw new Error(error.message);
}

export function describeSync(s: SyncSummary): string {
  if (!s.imported && !s.skipped && !s.failed) return "Gmail is up to date";
  const parts = [`${s.imported} imported`];
  if (s.skipped) parts.push(`${s.skipped} skipped`);
  if (s.failed) parts.push(`${s.failed} will retry`);
  return `Gmail: ${parts.join(", ")}`;
}
