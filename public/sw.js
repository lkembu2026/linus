// =============================================
// LK PharmaCare — Service Worker v3
// Offline-first for static assets / app shell
// Network-first for all other requests
// =============================================

const CACHE_VERSION = "lk-pharmacare-v3";

// App-shell routes to pre-cache on install
const APP_SHELL = [
  "/",
  "/dashboard",
  "/sales",
  "/inventory",
  "/reports",
  "/transfers",
  "/branches",
  "/users",
  "/settings",
  "/audit",
  "/manifest.json",
  "/LKL.webp",
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
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

  // Skip Supabase REST/auth requests
  if (url.hostname.includes("supabase")) return;

  // _next/static — cache-first (content-addressed, never change)
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

  // RSC data requests — network first, cache fallback so pages render offline
  if (url.pathname.startsWith("/_next/data/") || url.searchParams.has("_rsc")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })),
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
                new Response(OFFLINE_PAGE, {
                  status: 200,
                  headers: { "Content-Type": "text/html" },
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

// Minimal offline fallback HTML
const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LK PharmaCare — Offline</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0D0D0D;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:2rem}
    .box{max-width:400px}
    h1{color:#00FFE0;margin-bottom:.5rem}
    p{color:#999;line-height:1.6}
    button{margin-top:1.5rem;padding:.75rem 2rem;background:#00FFE0;color:#0D0D0D;
    border:none;border-radius:8px;font-weight:600;font-size:1rem;cursor:pointer}
    button:hover{background:#00B8A9}
  </style>
</head>
<body>
  <div class="box">
    <h1>You're Offline</h1>
    <p>LK PharmaCare needs to load at least once while online. 
       The POS (sales) page works offline after that first load.</p>
    <p>Check your internet connection and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`;
