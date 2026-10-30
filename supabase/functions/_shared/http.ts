import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Origins the app is served from; also the only allowed OAuth return targets. */
export const APP_ORIGINS = ["https://pockit-five.vercel.app", "http://localhost:3000"];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": APP_ORIGINS.includes(origin) ? origin : APP_ORIGINS[0]!,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Service-role client. Bypasses RLS: every query must filter by user_id explicitly. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The signed-in Pockit user behind the request's bearer token, or null. */
export async function requestUserId(req: Request, db: SupabaseClient): Promise<string | null> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const { data } = await db.auth.getUser(header.slice("Bearer ".length));
  return data.user?.id ?? null;
}
