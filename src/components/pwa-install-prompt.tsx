"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "lk-pwa-install-dismissed";

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const mediaMatch = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    );

  return mediaMatch || iosStandalone;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(true);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isPrompting, setIsPrompting] = useState(false);

  const isIos = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsInstalled(isStandaloneMode());
    setIsDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "true");

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsInstalled(false);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setIsDismissed(true);
      window.sessionStorage.removeItem(DISMISS_KEY);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const shouldShow =
    !isInstalled && !isDismissed && (Boolean(deferredPrompt) || isIos);

  function dismissPrompt() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_KEY, "true");
    }
    setIsDismissed(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) {
      return;
    }

    setIsPrompting(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setIsDismissed(true);
      }
    } finally {
      setDeferredPrompt(null);
      setIsPrompting(false);
    }
  }

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 md:left-auto md:right-6 md:w-[420px]">
      <div className="rounded-2xl border border-primary/30 bg-[#101010]/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            {isIos ? (
              <Share2 className="h-5 w-5" />
            ) : (
              <Smartphone className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  Install Linmaks PharmaCare
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use the app with a faster, more native experience and offline
                  support.
                </p>
              </div>

              <button
                type="button"
                onClick={dismissPrompt}
                className="rounded-full p-1 text-muted-foreground transition hover:bg-white/5 hover:text-white"
                aria-label="Dismiss install prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIos ? (
              <p className="mt-3 text-xs text-muted-foreground">
                On iPhone or iPad, tap <span className="text-white">Share</span>{" "}
                then choose{" "}
                <span className="text-white">Add to Home Screen</span>.
              </p>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void handleInstall()}
                  disabled={isPrompting}
                  className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                >
                  <Download className="h-4 w-4" />
                  {isPrompting ? "Opening..." : "Install App"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={dismissPrompt}
                  className="text-muted-foreground hover:text-white"
                >
                  Not now
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
