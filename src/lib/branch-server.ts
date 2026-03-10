import { cookies } from "next/headers";
import { ACTIVE_BRANCH_COOKIE, ALL_BRANCHES_VALUE } from "@/lib/branch";
import { isAdminRole } from "@/lib/permissions";

export type BranchScopedUser = {
  role?: string;
  branch_id?: string | null;
};

export async function getEffectiveBranchId(
  user: BranchScopedUser | null | undefined,
): Promise<string | null> {
  if (!user) return null;

  if (isAdminRole(user.role)) {
    const cookieStore = await cookies();
    const selectedBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
    if (selectedBranchId === ALL_BRANCHES_VALUE) return null;
    if (selectedBranchId) return selectedBranchId;
    return null;
  }

  return user.branch_id ?? null;
}
