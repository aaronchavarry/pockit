"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { GmailSection } from "@/components/account/gmail-section";
import { ExpenseEditorProvider, useExpenseEditor } from "@/components/expenses/expense-editor";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { HomeIcon, PieIcon, PlusIcon, ReceiptIcon, TagIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/misc";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { getSupabase } from "@/data/supabase-client";
import { createSupabaseStore } from "@/data/supabase-store";
import { currentAccount, getAppMode, setAppMode, signOut, type Account } from "@/services/auth/account-service";
import { describeSync, syncGmailNow } from "@/services/email/gmail-service";
import { DataProvider, seedAccount, useData } from "@/state/data-provider";
import { Logo, LogoMark } from "./logo";

const NAV = [
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/expenses", label: "Expenses", Icon: ReceiptIcon },
  { href: "/budgets", label: "Budgets", Icon: PieIcon },
  { href: "/categories", label: "Categories", Icon: TagIcon },
] as const;

/** What the shell is showing: the local sample demo, or a signed-in account. */
type Session = { mode: "demo" } | { mode: "cloud"; account: Account };

const SessionContext = createContext<Session>({ mode: "demo" });

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const account = getAppMode() === "cloud" ? await currentAccount() : null;
      if (cancelled) return;
      if (getAppMode() === "cloud" && !account) {
        // Signed out or session gone: back to the entry screen.
        setAppMode("demo");
        router.replace("/");
        return;
      }
      setSession(account ? { mode: "cloud", account } : { mode: "demo" });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!session) return <Spinner label="Opening Pockit" />;

  const db = getSupabase();
  const account = session.mode === "cloud" ? session.account : null;
  const cloud = account && db ? { storeFactory: async () => createSupabaseStore(db, account.userId), initialize: seedAccount } : {};

  return (
    <SessionContext.Provider value={session}>
      <DataProvider key={session.mode} {...cloud}>
        <ToastProvider>
          <ExpenseEditorProvider>
            <ShellFrame>{children}</ShellFrame>
          </ExpenseEditorProvider>
        </ToastProvider>
      </DataProvider>
    </SessionContext.Provider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Grid column of the active tab in the mobile bar; column 2 is the add pill.
  const navIndex = NAV.findIndex((n) => n.href === pathname);
  const activeCol = navIndex < 0 ? -1 : navIndex < 2 ? navIndex : navIndex + 1;
  const { status, error, persistent, mutate } = useData();
  const session = useContext(SessionContext);
  const toast = useToast();
  const [demoOpen, setDemoOpen] = useState(false);

  // Back from Google's Gmail consent (gmail-oauth-callback redirects to /home?gmail=…).
  useEffect(() => {
    if (status !== "ready" || session.mode !== "cloud") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail");
    if (!result) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (result !== "connected") {
      toast(params.get("reason") === "cancelled" ? "Gmail connection cancelled" : "Couldn’t connect Gmail. Please try again.");
      return;
    }
    toast("Gmail connected. Checking your emails…");
    mutate(() => syncGmailNow())
      .then((summary) => toast(describeSync(summary)))
      .catch((e: unknown) => toast(e instanceof Error ? e.message : "Gmail sync failed."));
  }, [status, session.mode, mutate, toast]);

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <Link href="/home" className="mb-7 px-3 py-1" aria-label="Pockit home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-[var(--radius-tile)] px-3 text-[0.925rem] font-medium transition-colors ${
                  active ? "bg-muted text-ink" : "text-ink-3 hover:bg-muted hover:text-ink"
                }`}
              >
                <Icon key={String(active)} size={20} filled={active} className={active ? "animate-tab-pop" : undefined} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <SessionPill session={session} onClick={() => setDemoOpen(true)} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),0.875rem)] pb-1 lg:hidden">
          <Link href="/home" aria-label="Pockit home">
            <LogoMark size={24} />
          </Link>
          <SessionPill session={session} onClick={() => setDemoOpen(true)} />
        </header>

        {!persistent && status === "ready" && (
          <p role="status" className="mx-5 mt-3 rounded-[var(--radius-field)] bg-orange-soft px-4 py-2.5 text-sm text-orange-ink lg:mx-10">
            Browser storage is unavailable, so changes will be lost when you close this tab.
          </p>
        )}

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 pt-5 pb-36 sm:px-8 lg:px-12 lg:pt-10 lg:pb-16">
          {status === "loading" && <Spinner label={session.mode === "cloud" ? "Loading your expenses" : "Loading your demo"} />}
          {status === "error" && (
            <div role="alert" className="py-20 text-center">
              <p className="font-medium">
                {session.mode === "cloud"
                  ? "Pockit couldn’t reach your account. Check your connection."
                  : "Pockit couldn’t open its local storage."}
              </p>
              <p className="mt-1 text-sm text-ink-3">{error}</p>
              <Button className="mt-5" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          )}
          {status === "ready" && (
            // Keyed by route so every module change replays the entrance motion.
            <div key={pathname} className="animate-page-in">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Mobile floating navigation: two destinations either side of a central add pill. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-30 mx-auto max-w-md rounded-[1.75rem] border border-black/[0.06] bg-white/70 backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      >
        {activeCol >= 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/5)] rounded-[1.375rem] bg-black/[0.05] transition-transform duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)]"
            style={{ transform: `translateX(${activeCol * 100}%)` }}
          />
        )}
        <ul className="relative grid h-16 grid-cols-5 items-center px-1.5">
          {NAV.slice(0, 2).map((item) => (
            <MobileNavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
          <li className="flex justify-center">
            <MobileAddButton disabled={status !== "ready"} />
          </li>
          {NAV.slice(2).map((item) => (
            <MobileNavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
        </ul>
      </nav>

      {session.mode === "cloud" ? (
        <AccountDialog account={session.account} open={demoOpen} onClose={() => setDemoOpen(false)} />
      ) : (
        <DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
      )}
    </div>
  );
}

function MobileNavItem({ href, label, Icon, active }: (typeof NAV)[number] & { active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex h-12 flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium transition-colors ${
          active ? "text-ink" : "text-ink-3 hover:text-ink-2"
        }`}
      >
        <Icon key={String(active)} size={22} filled={active} className={active ? "animate-tab-pop" : undefined} />
        {label}
      </Link>
    </li>
  );
}

function MobileAddButton({ disabled }: { disabled: boolean }) {
  const editor = useExpenseEditor();
  return (
    <button
      type="button"
      aria-label="Add expense"
      disabled={disabled}
      onClick={() => editor.openNew()}
      className="inline-flex h-10 w-14 items-center justify-center rounded-[0.875rem] bg-ink text-white transition-colors hover:bg-[#2a2a2e] disabled:opacity-40"
    >
      <PlusIcon size={22} />
    </button>
  );
}

function SessionPill({ session, onClick }: { session: Session; onClick: () => void }) {
  const cloud = session.mode === "cloud";
  return (
    <button
      type="button"
      onClick={onClick}
      title={cloud ? session.account.email : undefined}
      className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-tile)] bg-muted px-2.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line hover:bg-track"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cloud ? "bg-positive" : "bg-orange"}`} aria-hidden="true" />
      {cloud ? "Account" : "Demo mode"}
    </button>
  );
}

function AccountDialog({ account, open, onClose }: { account: Account; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your account"
      description={<>Signed in as {account.email}. Your expenses are saved to your Pockit account.</>}
    >
      <div className="flex flex-col gap-3 pt-2">
        <GmailSection />
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut();
            onClose();
            router.replace("/");
          }}
        >
          Sign out
        </Button>
      </div>
    </Dialog>
  );
}

function DemoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { resetDemo } = useData();
  const toast = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setConfirming(false);
        onClose();
      }}
      title="You’re using the demo"
      description="Sample data, stored only in this browser. Nothing is synced or sent anywhere."
      size="sm"
    >
      <div className="flex flex-col gap-3 pt-2">
        {confirming ? (
          <>
            <p className="text-sm text-ink-2">
              This replaces everything you’ve added or changed with the original sample data.
            </p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await resetDemo();
                setBusy(false);
                setConfirming(false);
                onClose();
                toast("Demo data restored");
              }}
            >
              Reset demo data
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              Reset demo data…
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onClose();
                router.push("/");
              }}
            >
              Back to welcome screen
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
