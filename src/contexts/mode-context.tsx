"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppMode } from "@/types";
import {
  MODE_STORAGE_KEY,
  normalizeMode,
  resolveAllowedMode,
} from "@/lib/mode";

interface ModeContextValue {
  mode: AppMode;
  allowedModes: AppMode[];
  setMode: (mode: AppMode) => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: "pharmacy",
  allowedModes: ["pharmacy", "beauty"],
  setMode: () => {},
});

export function ModeProvider({
  children,
  initialMode = "pharmacy",
  allowedModes = ["pharmacy", "beauty"],
}: {
  children: React.ReactNode;
  initialMode?: AppMode;
  allowedModes?: AppMode[];
}) {
  const normalizedAllowedModes = useMemo(
    () =>
      allowedModes.length > 0 ? allowedModes : (["pharmacy"] as AppMode[]),
    [allowedModes],
  );
  const [mode, setModeState] = useState<AppMode>(() => {
    if (typeof window === "undefined") {
      return resolveAllowedMode(initialMode, normalizedAllowedModes);
    }

    try {
      return resolveAllowedMode(
        normalizeMode(window.localStorage.getItem(MODE_STORAGE_KEY)),
        normalizedAllowedModes,
      );
    } catch {
      return resolveAllowedMode(initialMode, normalizedAllowedModes);
    }
  });
  const resolvedMode = resolveAllowedMode(mode, normalizedAllowedModes);

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

  useEffect(() => {
    persistMode(resolvedMode);
  }, [resolvedMode]);

  function setMode(newMode: AppMode) {
    const resolvedMode = resolveAllowedMode(newMode, normalizedAllowedModes);
    if (resolvedMode === mode) return;
    setModeState(resolvedMode);
    persistMode(resolvedMode);
  }

  return (
    <ModeContext.Provider
      value={{
        mode: resolvedMode,
        allowedModes: normalizedAllowedModes,
        setMode,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
