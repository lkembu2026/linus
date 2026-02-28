// =============================================
// LK PharmaCare — Service Worker v2
// Offline-first for static assets / app shell
// Network-first for all other requests
// =============================================

const CACHE_VERSION = "lk-pharmacare-v2";

// App-shell routes to pre-cache on install
const APP_SHELL = [
  "/",
  "/dashboard",
  "/sales",
  "/inventory",
  "/reports",
  "/manifest.json",
  "/LKL.webp",
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        // addAll fails if ANY request fails — use individual puts instead
        Promise.allSettled(
          APP_SHELL.map((url) =>
            fetch(url)
              .then((res) => {
                if (res.ok) cache.put(url, res);
              })
              .catch(() => {}),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests — POST (server actions, supabase) are never cached
  if (request.method !== "GET") return;

  // Skip cross-origin requests (analytics, CDNs, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip the connectivity probe so it never returns a stale cached result
  if (url.pathname === "/api/ping") return;

  // Skip Supabase and Next.js internal requests
  if (
    url.pathname.startsWith("/_next/data/") ||
    url.hostname.includes("supabase")
  )
    return;

  // _next/static — cache-first (these are content-addressed, never change)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else — network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Navigation fallback — serve the cached root shell
          if (request.mode === "navigate") {
            return caches.match("/").then(
              (root) =>
                root ||
                new Response("Offline — please reload when connected", {
                  status: 503,
                  headers: { "Content-Type": "text/plain" },
                }),
            );
          }
          return new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }),
      ),
  );
});
