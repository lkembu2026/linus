import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/actions/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ModeProvider } from "@/contexts/mode-context";
import { MODE_STORAGE_KEY, normalizeMode } from "@/lib/mode";

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

  return (
    <ModeProvider initialMode={initialMode}>
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
