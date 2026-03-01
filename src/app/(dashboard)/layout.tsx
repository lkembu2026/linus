import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/actions/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ModeProvider } from "@/contexts/mode-context";
import { MODE_STORAGE_KEY, normalizeMode } from "@/lib/mode";
import { ACTIVE_BRANCH_COOKIE, ALL_BRANCHES_VALUE } from "@/lib/branch";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialMode = normalizeMode(cookieStore.get(MODE_STORAGE_KEY)?.value);
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  let branchName = (user as any).branch?.name as string | undefined;
  let branchId = user.branch_id ?? undefined;
  let branchSelection = branchId ?? ALL_BRANCHES_VALUE;

  if (user.role === "admin") {
    const selectedBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;

    if (!selectedBranchId || selectedBranchId === ALL_BRANCHES_VALUE) {
      branchName = "All Branches";
      branchId = undefined;
      branchSelection = ALL_BRANCHES_VALUE;
    } else {
      const supabase = await createClient();
      const { data: selectedBranch } = await supabase
        .from("branches")
        .select("id, name")
        .eq("id", selectedBranchId)
        .single();

      if (selectedBranch) {
        branchName = (selectedBranch as { name: string }).name;
        branchId = (selectedBranch as { id: string }).id;
        branchSelection = selectedBranchId;
      } else {
        branchName = "All Branches";
        branchId = undefined;
        branchSelection = ALL_BRANCHES_VALUE;
      }
    }
  }

  return (
    <ModeProvider initialMode={initialMode}>
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
