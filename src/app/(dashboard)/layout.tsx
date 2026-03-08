import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/actions/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ModeProvider } from "@/contexts/mode-context";
import {
  MODE_STORAGE_KEY,
  getAllowedModesForBranch,
  normalizeMode,
  resolveAllowedMode,
} from "@/lib/mode";
import { ACTIVE_BRANCH_COOKIE, ALL_BRANCHES_VALUE } from "@/lib/branch";
import { createClient } from "@/lib/supabase/server";
import type { Branch } from "@/types";

type UserBranchSettings = {
  name: string;
  enable_pharmacy: boolean;
  enable_beauty: boolean;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const requestedMode = normalizeMode(cookieStore.get(MODE_STORAGE_KEY)?.value);
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const userBranch = user.branch as UserBranchSettings | null | undefined;
  let branchName = userBranch?.name;
  let branchId = user.branch_id ?? undefined;
  let branchSelection = branchId ?? ALL_BRANCHES_VALUE;
  let allowedModes = getAllowedModesForBranch({
    enable_pharmacy: true,
    enable_beauty: true,
  });

  if (user.role === "admin") {
    const selectedBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;

    if (!selectedBranchId || selectedBranchId === ALL_BRANCHES_VALUE) {
      branchName = "All Branches";
      branchId = undefined;
      branchSelection = ALL_BRANCHES_VALUE;
      allowedModes = ["pharmacy", "beauty"];
    } else {
      const supabase = await createClient();
      const { data: selectedBranch } = await supabase
        .from("branches")
        .select("id, name, enable_pharmacy, enable_beauty")
        .eq("id", selectedBranchId)
        .single<Pick<Branch, "id" | "name" | "enable_pharmacy" | "enable_beauty">>();

      if (selectedBranch) {
        branchName = selectedBranch.name;
        branchId = selectedBranch.id;
        branchSelection = selectedBranchId;
        allowedModes = getAllowedModesForBranch(selectedBranch);
      } else {
        branchName = "All Branches";
        branchId = undefined;
        branchSelection = ALL_BRANCHES_VALUE;
        allowedModes = ["pharmacy", "beauty"];
      }
    }
  } else {
    allowedModes = getAllowedModesForBranch({
      enable_pharmacy: userBranch?.enable_pharmacy ?? true,
      enable_beauty: userBranch?.enable_beauty ?? true,
    });
  }

  const initialMode = resolveAllowedMode(requestedMode, allowedModes);

  return (
    <ModeProvider initialMode={initialMode} allowedModes={allowedModes}>
      <DashboardShell
        userName={user.full_name}
        userRole={user.role}
        branchName={branchName}
        branchId={branchId}
        branchSelection={branchSelection}
      >
        {children}
      </DashboardShell>
    </ModeProvider>
  );
}
