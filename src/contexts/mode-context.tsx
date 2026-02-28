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
        setModeState(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  function setMode(newMode: AppMode) {
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
