"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);

          // When a new SW is found, activate it immediately
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "activated" &&
                navigator.serviceWorker.controller
              ) {
                // New service worker activated — the cache version changed
                console.log("New SW activated, cache updated");
              }
            });
          });
        })
        .catch((err) => {
          console.error("SW registration failed:", err);
        });

      // Check for SW updates every 60 minutes
      setInterval(
        () => {
          navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) reg.update();
          });
        },
        60 * 60 * 1000,
      );
    }
  }, []);

  return null;
}
