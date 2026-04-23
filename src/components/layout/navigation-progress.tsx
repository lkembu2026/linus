"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin animated progress bar at the top of the viewport,
 * triggered on every Next.js client-side navigation.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setProgress(0);
    setVisible(true);

    let value = 0;
    intervalRef.current = setInterval(() => {
      value += Math.random() * 15;
      if (value >= 90) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        value = 90;
      }
      setProgress(value);
    }, 150);
  }, [clearTimers]);

  const finish = useCallback(() => {
    clearTimers();
    setProgress(100);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, [clearTimers]);

  // Detect navigation by watching pathname + searchParams changes
  useEffect(() => {
    finish();
  }, [pathname, searchParams, finish]);

  // Listen for click on internal links to start the bar
  useEffect(() => {
    let linkCleanup: (() => void) | undefined;

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) return;

      // Starting a navigation to a different page
      const current = window.location.pathname + window.location.search;
      if (href !== current && !href.startsWith("mailto:")) {
        linkCleanup?.();
        start();
        linkCleanup = clearTimers;
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      linkCleanup?.();
    };
  }, [start, clearTimers]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[3px]">
      <div
        className="h-full bg-primary shadow-[0_0_10px_rgba(0,255,224,0.5)] transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
