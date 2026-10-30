import { getSupabase } from "@/data/supabase-client";

/**
 * Which data the app shell opens: the local sample "demo", or the signed-in
 * user's "cloud" account. Remembered per browser so a reload stays put.
 */
export type AppMode = "demo" | "cloud";

const MODE_KEY = "pockit-mode";

export function getAppMode(): AppMode {
  try {
    return localStorage.getItem(MODE_KEY) === "cloud" ? "cloud" : "demo";
  } catch {
    return "demo";
  }
}

export function setAppMode(mode: AppMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage blocked: the app falls back to the demo on the next load.
  }
}

export interface Account {
  userId: string;
  email: string;
}

/** The signed-in account from the stored session (works offline), or null. */
export async function currentAccount(): Promise<Account | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  const user = data.session?.user;
  return user ? { userId: user.id, email: user.email ?? "" } : null;
}

/** Starts Google sign-in: the browser navigates to Google. Resolves with an error message, or null. */
export async function signInWithGoogle(): Promise<string | null> {
  const db = getSupabase();
  if (!db) return "Sign-in isn't available in this build.";
  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  return error ? error.message : null;
}

/** Finishes the OAuth redirect on /auth/callback. */
export async function completeSignIn(params: URLSearchParams): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, message: "Sign-in isn't available in this build." };

  const providerError = params.get("error_description") ?? params.get("error");
  if (providerError) return { ok: false, message: friendlyAuthError(providerError) };

  const code = params.get("code");
  if (!code) return { ok: false, message: "The sign-in link is incomplete. Please try again." };

  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return { ok: false, message: friendlyAuthError(error.message) };
  setAppMode("cloud");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
  setAppMode("demo");
}

function friendlyAuthError(message: string): string {
  // The allow-list trigger surfaces through GoTrue as a generic database error.
  if (/invite-only|database error saving new user/i.test(message)) {
    return "Pockit is invite-only right now, and this Google account isn’t on the list.";
  }
  if (/access_denied|denied/i.test(message)) return "Sign-in was cancelled.";
  return `Sign-in didn’t work: ${message}`;
}
