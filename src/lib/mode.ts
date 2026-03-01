import { BEAUTY_CATEGORIES, MEDICINE_CATEGORIES } from "@/lib/constants";
import type { AppMode } from "@/types";

export const MODE_STORAGE_KEY = "lk-pharmacare-mode";

export function normalizeMode(value?: string | null): AppMode {
  return value === "beauty" ? "beauty" : "pharmacy";
}

export function getCategoriesForMode(mode: AppMode): string[] {
  return mode === "beauty" ? [...BEAUTY_CATEGORIES] : [...MEDICINE_CATEGORIES];
}
