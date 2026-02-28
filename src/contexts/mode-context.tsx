"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { AppMode } from "@/types";

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: "pharmacy",
  setMode: () => {},
});

const STORAGE_KEY = "lk-pharmacare-mode";

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("pharmacy");

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "pharmacy" || stored === "beauty") {
        console.log("[Mode] Hydrated from localStorage:", stored);
        setModeState(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    console.log("[Mode] Current mode:", mode);
  }, [mode]);

  function setMode(newMode: AppMode) {
    console.log("[Mode] setMode called:", { from: mode, to: newMode });
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // ignore
    }
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
