"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds only (dev caching gets in the way). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline support is progressive; the app works without it.
    });
  }, []);
  return null;
}
