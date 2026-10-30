"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { GoogleMark } from "@/components/ui/icons";
import { isCloudConfigured } from "@/data/supabase-client";
import { currentAccount, setAppMode, signInWithGoogle } from "@/services/auth/account-service";

const googleClass =
  "inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-[0.875rem] text-base font-medium transition-colors";

/** "Try demo" + "Continue with Google". Google is only offered when the build has an account backend. */
export function EntryActions() {
  const router = useRouter();
  const configured = isCloudConfigured();
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    currentAccount().then((a) => !cancelled && setSignedIn(Boolean(a)));
    return () => {
      cancelled = true;
    };
  }, [configured]);

  async function google() {
    setError(null);
    if (signedIn) {
      setAppMode("cloud");
      router.push("/home");
      return;
    }
    setBusy(true);
    const message = await signInWithGoogle();
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <>
      {configured ? (
        <button type="button" onClick={google} disabled={busy} className={`${googleClass} bg-ink text-white hover:bg-[#2a2a2e] disabled:opacity-60`}>
          <GoogleMark />
          {signedIn ? "Open my Pockit" : busy ? "Opening Google…" : "Continue with Google"}
        </button>
      ) : (
        <button
          type="button"
          disabled
          aria-describedby="google-soon"
          className={`${googleClass} cursor-not-allowed bg-muted text-ink-3`}
        >
          <GoogleMark />
          Continue with Google
          <span id="google-soon" className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-ink-3 ring-1 ring-inset ring-line">
            Coming soon
          </span>
        </button>
      )}
      <ButtonLink
        href="/home"
        size="lg"
        variant={configured ? "secondary" : "primary"}
        className="w-full"
        onClick={() => setAppMode("demo")}
      >
        Try demo
      </ButtonLink>
      {error && (
        <p role="alert" className="text-center text-sm text-negative">
          {error}
        </p>
      )}
    </>
  );
}
