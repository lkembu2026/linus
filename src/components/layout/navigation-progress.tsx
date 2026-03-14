"use client";

import { useEffect, useState, useCallback } from "react";
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

  const start = useCallback(() => {
    setProgress(0);
    setVisible(true);

    // Animate to ~70% quickly, then slow down
    let value = 0;
    const id = setInterval(() => {
      value += Math.random() * 15;
      if (value >= 90) {
        clearInterval(id);
        value = 90;
      }
      setProgress(value);
    }, 150);

    return () => clearInterval(id);
  }, []);

  const finish = useCallback(() => {
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, []);

  // Detect navigation by watching pathname + searchParams changes
  useEffect(() => {
    finish();
  }, [pathname, searchParams, finish]);

  // Listen for click on internal links to start the bar
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) return;

      // Starting a navigation to a different page
      const current = window.location.pathname + window.location.search;
      if (href !== current && !href.startsWith("mailto:")) {
        cleanup?.();
        cleanup = start();
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      cleanup?.();
    };
  }, [start]);

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
