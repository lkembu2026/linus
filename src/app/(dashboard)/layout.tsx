import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ModeProvider } from "@/contexts/mode-context";

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
    <ModeProvider>
      <DashboardShell
        userName={user.full_name}
        userRole={user.role}
        branchName={(user as any).branch?.name}
      >
        {children}
      </DashboardShell>
    </ModeProvider>
  );
}
