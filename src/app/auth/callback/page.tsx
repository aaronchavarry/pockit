"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { completeSignIn } from "@/services/auth/account-service";

/** Google sends the user back here; exchange the code, then open the app. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The code is single-use: guard against the dev-mode double effect.
    if (started.current) return;
    started.current = true;
    completeSignIn(new URLSearchParams(window.location.search)).then((result) => {
      if (result.ok) router.replace("/home");
      else setError(result.message);
    });
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-8">
      <Logo />
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        {error ? (
          <div role="alert">
            <p className="text-lg font-semibold text-ink">Couldn’t sign you in</p>
            <p className="mt-2 text-sm text-ink-3">{error}</p>
            <Link href="/" className={buttonClass("primary", "md", "mt-6")}>
              Back to start
            </Link>
          </div>
        ) : (
          <Spinner label="Signing you in" />
        )}
      </section>
    </main>
  );
}
