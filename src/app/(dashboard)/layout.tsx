import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      userName={user.full_name}
      userRole={user.role}
      branchName={(user as any).branch?.name}
    >
      {children}
    </DashboardShell>
  );
}
