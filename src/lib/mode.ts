import { BEAUTY_CATEGORIES, MEDICINE_CATEGORIES } from "@/lib/constants";
import type { AppMode, Branch } from "@/types";
import { getCurrentUser } from "@/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveBranchId } from "@/lib/branch-server";

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

export async function getAllowedModesForCurrentBranch(): Promise<AppMode[]> {
  const user = await getCurrentUser();

  if (!user) {
    return ["pharmacy", "beauty"];
  }

  if (user.role === "admin") {
    const branchId = await getEffectiveBranchId(user);
    if (!branchId) {
      return ["pharmacy", "beauty"];
    }

    const supabase = await createClient();
    const { data: branch } = await supabase
      .from("branches")
      .select("enable_pharmacy, enable_beauty")
      .eq("id", branchId)
      .single();

    return getAllowedModesForBranch(
      (branch as Pick<Branch, "enable_pharmacy" | "enable_beauty"> | null) ??
        null,
    );
  }

  return getAllowedModesForBranch(user.branch ?? null);
}

export async function resolveCurrentBranchMode(
  requestedMode?: string | null,
): Promise<AppMode> {
  const allowedModes = await getAllowedModesForCurrentBranch();
  return resolveAllowedMode(normalizeMode(requestedMode), allowedModes);
}
