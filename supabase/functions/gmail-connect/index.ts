// Starts the Gmail connection for the signed-in Pockit user: returns the Google consent URL.
import { adminClient, APP_ORIGINS, corsHeaders, json, requestUserId } from "../_shared/http.ts";
import { gmailAuthUrl } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const db = adminClient();
  const userId = await requestUserId(req, db);
  if (!userId) return json(req, { error: "Sign in to Pockit first." }, 401);

  const { returnTo } = (await req.json().catch(() => ({}))) as { returnTo?: string };
  if (!returnTo || !APP_ORIGINS.includes(returnTo)) return json(req, { error: "Unknown return address." }, 400);

  const { data: state, error } = await db.rpc("gmail_create_state", { p_user_id: userId, p_return_to: returnTo });
  if (error || typeof state !== "string") {
    console.error("gmail-connect: state", error?.message);
    return json(req, { error: "Couldn't start the Gmail connection." }, 500);
  }
  return json(req, { url: gmailAuthUrl(state) });
});
