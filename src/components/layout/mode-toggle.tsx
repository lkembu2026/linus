"use client";

import { useMode } from "@/contexts/mode-context";
import { cn } from "@/lib/utils";
import { Loader2, Pill, Sparkles } from "lucide-react";
import { useState } from "react";

export function ModeToggle() {
  const { mode, allowedModes, setMode } = useMode();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  function handleSwitch(next: "pharmacy" | "beauty") {
    if (next === mode) return;
    setSwitchingTo(next);
    setMode(next);
    setTimeout(() => setSwitchingTo(null), 600);
  }

  if (allowedModes.length <= 1) {
    const onlyMode = allowedModes[0] ?? "pharmacy";

    return (
      <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 px-3 py-1.5 text-xs font-medium text-primary">
        {onlyMode === "beauty" ? (
          <Sparkles className="h-3.5 w-3.5" />
        ) : (
          <Pill className="h-3.5 w-3.5" />
        )}
        {onlyMode === "beauty" ? "Beauty" : "Pharmacy"}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      {allowedModes.includes("pharmacy") && (
        <button
          onClick={() => handleSwitch("pharmacy")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
            mode === "pharmacy"
              ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,255,224,0.3)]"
              : "text-muted-foreground hover:text-white",
          )}
        >
          {switchingTo === "pharmacy" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Pill className="h-3.5 w-3.5" />
          )}
          Pharmacy
        </button>
      )}
      {allowedModes.includes("beauty") && (
        <button
          onClick={() => handleSwitch("beauty")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
            mode === "beauty"
              ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,255,224,0.3)]"
              : "text-muted-foreground hover:text-white",
          )}
        >
          {switchingTo === "beauty" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Beauty
        </button>
      )}
    </div>
  );
}
