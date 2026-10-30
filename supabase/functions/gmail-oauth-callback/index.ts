// Google redirects here after consent. No Pockit JWT on this request: the single-use
// state created by gmail-connect identifies the user. Stores the refresh token in Vault.
import { adminClient } from "../_shared/http.ts";
import { exchangeCode, gmailGet } from "../_shared/google.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const db = adminClient();

  const { data: rows } = state ? await db.rpc("gmail_consume_state", { p_state: state }) : { data: null };
  const session = (rows as Array<{ user_id: string; return_to: string }> | null)?.[0];
  if (!session) {
    return new Response("This Gmail connection link has expired. Go back to Pockit and try again.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const back = (status: "connected" | "error", reason?: string) =>
    Response.redirect(`${session.return_to}/home?gmail=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`, 302);

  const googleError = url.searchParams.get("error");
  if (googleError) return back("error", googleError === "access_denied" ? "cancelled" : googleError);
  const code = url.searchParams.get("code");
  if (!code) return back("error", "missing_code");

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refreshToken) return back("error", "no_refresh_token");
    const profile = await gmailGet<{ emailAddress: string }>(tokens.accessToken, "profile");
    const { error } = await db.rpc("gmail_save_connection", {
      p_user_id: session.user_id,
      p_google_email: profile.emailAddress,
      p_refresh_token: tokens.refreshToken,
    });
    if (error) throw new Error(error.message);
    return back("connected");
  } catch (e) {
    console.error("gmail-oauth-callback:", e instanceof Error ? e.message : String(e));
    return back("error", "exchange_failed");
  }
});
