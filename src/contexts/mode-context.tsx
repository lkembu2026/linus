"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppMode } from "@/types";
import { MODE_STORAGE_KEY, normalizeMode } from "@/lib/mode";

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: "pharmacy",
  setMode: () => {},
});

export function ModeProvider({
  children,
  initialMode = "pharmacy",
}: {
  children: React.ReactNode;
  initialMode?: AppMode;
}) {
  const router = useRouter();
  const [mode, setModeState] = useState<AppMode>(initialMode);

  function persistMode(newMode: AppMode) {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
    } catch {
      // ignore
    }
    if (typeof document !== "undefined") {
      document.cookie = `${MODE_STORAGE_KEY}=${newMode}; path=/; max-age=31536000; samesite=lax`;
    }
  }

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      const localMode = normalizeMode(stored);
      if (localMode !== mode) {
        setModeState(localMode);
        persistMode(localMode);
      } else {
        persistMode(mode);
      }
    } catch {
      // ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setMode(newMode: AppMode) {
    if (newMode === mode) return;
    setModeState(newMode);
    persistMode(newMode);
    router.refresh();
  }

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
