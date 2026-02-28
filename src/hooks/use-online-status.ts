"use client";

import { useEffect, useState, useRef } from "react";
import {
  isActuallyOnline,
  invalidateConnectivityCache,
} from "@/lib/offline/connectivity";

/**
 * Reactive hook that tracks real internet connectivity.
 *
 * Unlike plain `navigator.onLine`, this actually probes the server so it
 * correctly returns `false` when the device is on WiFi/LAN but has no
 * active data bundles.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function probe() {
    const online = await isActuallyOnline();
    setIsOnline(online);
  }

  useEffect(() => {
    // Initial probe
    probe();

    // Re-probe when the browser fires online/offline events
    const handleOnline = () => {
      invalidateConnectivityCache();
      probe();
    };
    const handleOffline = () => {
      invalidateConnectivityCache();
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic probe every 15 s so the indicator stays accurate
    timerRef.current = setInterval(probe, 15_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return isOnline;
}
