import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values (URL + publishable key); access is enforced by RLS in the database.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/** True when this build has a Supabase project configured (account sign-in available). */
export function isCloudConfigured(): boolean {
  return Boolean(url && key);
}

/** Browser Supabase client, or null when the build has no Supabase configuration. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    auth: {
      flowType: "pkce",
      // /auth/callback exchanges the code explicitly so errors can be shown.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "pockit-auth",
    },
  });
  return client;
}
