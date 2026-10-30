"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  describeSync,
  disconnectGmail,
  loadGmail,
  startGmailConnect,
  syncGmailNow,
  type GmailConnection,
  type ImportLogEntry,
} from "@/services/email/gmail-service";
import { useData } from "@/state/data-provider";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; connection: GmailConnection; recent: ImportLogEntry[] };

/** Gmail import controls inside "Your account". */
export function GmailSection() {
  const { mutate } = useData();
  const toast = useToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect">(null);

  const refresh = useCallback(async () => setState(await fetchState()), []);

  useEffect(() => {
    let cancelled = false;
    fetchState().then((next) => !cancelled && setState(next));
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    setBusy("connect");
    const message = await startGmailConnect();
    if (message) {
      toast(message);
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      // mutate() reloads the app data afterwards, so imported expenses show up at once.
      const summary = await mutate(() => syncGmailNow());
      toast(describeSync(summary));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sync failed.");
    }
    await refresh();
    setBusy(null);
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      await disconnectGmail();
      toast("Gmail disconnected");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't disconnect Gmail.");
    }
    await refresh();
    setBusy(null);
  }

  return (
    <section aria-labelledby="gmail-title" className="rounded-[var(--radius-card)] border border-line p-4">
      <h3 id="gmail-title" className="text-sm font-semibold text-ink">
        Gmail import
      </h3>

      {state.status === "loading" && <p className="mt-1 text-sm text-ink-3">Checking…</p>}
      {state.status === "error" && <p className="mt-1 text-sm text-negative">{state.message}</p>}

      {state.status === "ready" && !state.connection.connected && (
        <>
          <p className="mt-1 text-sm text-ink-3">
            Adds BCP card purchases from your email every hour. Read-only; other emails are ignored.
          </p>
          <Button className="mt-3 w-full" disabled={busy !== null} onClick={connect}>
            {busy === "connect" ? "Opening Google…" : "Connect Gmail"}
          </Button>
        </>
      )}

      {state.status === "ready" && state.connection.connected && (
        <>
          <p className="mt-1 text-sm text-ink-2">
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${state.connection.needsReconnect ? "bg-orange" : "bg-positive"}`} aria-hidden="true" />
            {state.connection.email}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            {state.connection.lastSyncedAt ? `Last checked ${formatWhen(state.connection.lastSyncedAt)}` : "Not checked yet"}
          </p>
          {state.connection.lastError && <p className="mt-2 text-sm text-orange-ink">{state.connection.lastError}</p>}

          <div className="mt-3 grid grid-cols-2 gap-2">
            {state.connection.needsReconnect ? (
              <Button size="sm" disabled={busy !== null} onClick={connect}>
                {busy === "connect" ? "Opening Google…" : "Reconnect"}
              </Button>
            ) : (
              <Button size="sm" disabled={busy !== null} onClick={sync}>
                {busy === "sync" ? "Checking…" : "Sync now"}
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={disconnect}>
              Disconnect
            </Button>
          </div>

          {state.recent.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-xs" aria-label="Recent emails">
              {state.recent.map((r) => (
                <li key={r.messageId} className="flex justify-between gap-3">
                  <span className={r.status === "imported" ? "text-positive-ink" : "text-ink-3"}>
                    {r.status === "imported" ? "Imported" : `Skipped: ${r.reason ?? "not a purchase"}`}
                  </span>
                  <span className="shrink-0 text-ink-3 tabular">{r.receivedAt ? formatWhen(r.receivedAt) : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

async function fetchState(): Promise<State> {
  try {
    const { connection, recent } = await loadGmail();
    return { status: "ready", connection, recent };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Couldn't load Gmail status." };
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
