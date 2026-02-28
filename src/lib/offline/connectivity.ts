/**
 * Connectivity helpers — tests whether the device actually has internet
 * access, NOT just whether it has a local network link.
 *
 * `navigator.onLine` is unreliable: it returns `true` even when the device
 * is connected to a router/hotspot that has no active data bundles.  We fix
 * this by probing our own lightweight /api/ping endpoint with a short timeout.
 */

const PING_URL = "/api/ping";
const PING_TIMEOUT_MS = 4000;

let _cached: boolean | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 8000; // re-probe at most every 8 s

/**
 * Returns true only if the device can actually reach the server.
 * Results are cached for 8 s so rapid calls don't spam the network.
 */
export async function isActuallyOnline(): Promise<boolean> {
  const now = Date.now();
  if (_cached !== null && now - _cacheTs < CACHE_TTL_MS) return _cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    const res = await fetch(PING_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);

    _cached = res.ok;
    _cacheTs = Date.now();
    return _cached;
  } catch {
    _cached = false;
    _cacheTs = Date.now();
    return false;
  }
}

/** Invalidate cached result (call after a mode switch or known state change). */
export function invalidateConnectivityCache() {
  _cached = null;
  _cacheTs = 0;
}
