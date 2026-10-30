/* Pockit service worker — offline support for the local demo.
 * - App pages: network-first, fall back to cache (so updates win when online).
 * - Hashed build assets (/_next/static): cache-first (immutable).
 * - Never caches cross-origin or non-GET requests.
 * Future authenticated/API responses must not be added to these caches.
 */
const VERSION = "pockit-v1";
const PAGES = ["/", "/home", "/expenses", "/budgets", "/categories"];
const STATIC = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"];

async function precache() {
  const cache = await caches.open(VERSION);
  await cache.addAll(STATIC);
  // Cache each page plus the build assets it references, so every screen works offline.
  await Promise.all(
    PAGES.map(async (path) => {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) return;
        await cache.put(path, res.clone());
        const html = await res.text();
        const assets = new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || []);
        await Promise.all(
          [...assets].map((url) =>
            cache.match(url).then((hit) => hit || fetch(url).then((r) => r.ok && cache.put(url, r))).catch(() => undefined),
          ),
        );
      } catch {
        /* offline during install: runtime caching will fill in */
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Skip React Server Component payloads; the router falls back to a full page load offline.
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    const key = PAGES.includes(url.pathname) ? url.pathname : null;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && key) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(async () => (key && (await caches.match(key))) || (await caches.match("/home")) || Response.error()),
    );
  }
});
