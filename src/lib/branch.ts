import { cookies } from "next/headers";

export const ACTIVE_BRANCH_COOKIE = "lk-active-branch";
export const ALL_BRANCHES_VALUE = "__all__";

export type BranchScopedUser = {
  role?: string;
  branch_id?: string | null;
};

export async function getEffectiveBranchId(
  user: BranchScopedUser | null | undefined,
): Promise<string | null> {
  if (!user) return null;

  if (user.role === "admin") {
    const cookieStore = await cookies();
    const selectedBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
    if (selectedBranchId === ALL_BRANCHES_VALUE) return null;
    if (selectedBranchId) return selectedBranchId;
    return null;
  }

  return user.branch_id ?? null;
}
