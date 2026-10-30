/** Google OAuth + Gmail REST helpers (read-only). Secrets come from Edge Function env. */

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
// Must match the redirect URI registered on the Google OAuth client exactly.
export const GMAIL_CALLBACK_URL = "https://yhjdsjlysdoqosbhjyfw.supabase.co/functions/v1/gmail-oauth-callback";

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    /** True when the grant is gone (expired after 7 days in Testing, or revoked): the user must reconnect. */
    readonly revoked: boolean,
  ) {
    super(message);
  }
}

function credentials(): { id: string; secret: string } {
  const id = Deno.env.get("GOOGLE_CLIENT_ID");
  const secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  return { id, secret };
}

export function gmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: credentials().id,
    redirect_uri: GMAIL_CALLBACK_URL,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    // Always show consent so Google returns a refresh token on reconnect too.
    prompt: "consent select_account",
    include_granted_scopes: "false",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Record<string, string>> {
  const { id, secret } = credentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok) throw new GoogleAuthError(data.error_description ?? data.error ?? `HTTP ${res.status}`, data.error === "invalid_grant");
  return data;
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string | null }> {
  const data = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: GMAIL_CALLBACK_URL });
  return { accessToken: data.access_token!, refreshToken: data.refresh_token ?? null };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const data = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  return data.access_token!;
}

export async function gmailGet<T>(accessToken: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw new GoogleAuthError("Gmail rejected the access token", true);
  if (!res.ok) throw new Error(`Gmail API ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  internalDate: string;
  payload: GmailPart;
}

function decodeBase64Url(data: string): string {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Text of a message: text/plain when present, otherwise text/html. */
export function messageBody(payload: GmailPart): string {
  const found: Record<string, string> = {};
  const walk = (part: GmailPart) => {
    const type = part.mimeType ?? "";
    if ((type === "text/plain" || type === "text/html") && part.body?.data && !found[type]) found[type] = decodeBase64Url(part.body.data);
    part.parts?.forEach(walk);
  };
  walk(payload);
  return found["text/plain"] ?? found["text/html"] ?? "";
}
