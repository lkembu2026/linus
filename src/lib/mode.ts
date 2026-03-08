import { BEAUTY_CATEGORIES, MEDICINE_CATEGORIES } from "@/lib/constants";
import type { AppMode, Branch } from "@/types";

export const MODE_STORAGE_KEY = "lk-pharmacare-mode";

export function normalizeMode(value?: string | null): AppMode {
  return value === "beauty" ? "beauty" : "pharmacy";
}

export function getAllowedModesForBranch(
  branch?: Pick<Branch, "enable_pharmacy" | "enable_beauty"> | null,
): AppMode[] {
  if (!branch) {
    return ["pharmacy", "beauty"];
  }

  const allowed: AppMode[] = [];

  if (branch.enable_pharmacy) {
    allowed.push("pharmacy");
  }

  if (branch.enable_beauty) {
    allowed.push("beauty");
  }

  return allowed.length > 0 ? allowed : ["pharmacy"];
}

export function resolveAllowedMode(
  requestedMode: AppMode,
  allowedModes: AppMode[],
): AppMode {
  return allowedModes.includes(requestedMode)
    ? requestedMode
    : (allowedModes[0] ?? "pharmacy");
}

export function getCategoriesForMode(mode: AppMode): string[] {
  return mode === "beauty" ? [...BEAUTY_CATEGORIES] : [...MEDICINE_CATEGORIES];
}
