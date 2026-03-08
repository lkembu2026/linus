"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export function IdleSessionManager() {
  const pathname = usePathname();
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    const supabase = createClient();

    async function signOutForInactivity() {
      if (signingOutRef.current) {
        return;
      }

      signingOutRef.current = true;
      toast.error("Session expired after inactivity. Please sign in again.");
      await supabase.auth.signOut();
      router.replace("/login?reason=timeout");
      router.refresh();
    }

    function resetTimer() {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        void signOutForInactivity();
      }, IDLE_TIMEOUT_MS);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, router]);

  return null;
}
