"use client";

import { useMode } from "@/contexts/mode-context";
import { cn } from "@/lib/utils";
import { Pill, Sparkles } from "lucide-react";

export function ModeToggle() {
  const { mode, setMode } = useMode();

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      <button
        onClick={() => setMode("pharmacy")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
          mode === "pharmacy"
            ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,255,224,0.3)]"
            : "text-muted-foreground hover:text-white",
        )}
      >
        <Pill className="h-3.5 w-3.5" />
        Pharmacy
      </button>
      <button
        onClick={() => setMode("beauty")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
          mode === "beauty"
            ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,255,224,0.3)]"
            : "text-muted-foreground hover:text-white",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Beauty
      </button>
    </div>
  );
}
