"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Detects input from a USB/Bluetooth hardware barcode scanner.
 *
 * Hardware scanners send all characters within ~50ms and finish with Enter.
 * This hook distinguishes scanner input from regular keyboard typing by
 * measuring the time between keystrokes.
 *
 * Works even when no input is focused — just like a supermarket scanner.
 */
export function useHardwareScanner(
  onScan: (barcode: string) => void,
  enabled = true,
) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const code = bufferRef.current.trim();
    bufferRef.current = "";
    if (code.length >= 3) {
      onScan(code);
    }
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore modifier-only keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Ignore if user is typing in a real input (except the POS search field)
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isSearchInput =
        tag === "INPUT" &&
        (target as HTMLInputElement).dataset.scannerSearch === "true";

      // If focused on any non-scanner input, textarea, or contenteditable — let normal typing work
      if (
        (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) &&
        !isSearchInput
      ) {
        return;
      }

      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // If gap between keystrokes is > 80ms, this is likely a new/human input — reset
      if (gap > 80 && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      if (e.key === "Enter") {
        if (timerRef.current) clearTimeout(timerRef.current);
        flush();
        return;
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // Safety flush after 100ms of no keystrokes (handles scanners without Enter)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, 100);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, flush]);
}
