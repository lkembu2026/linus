import { getCurrentUser } from "@/actions/auth";
import { getAnalyticsBranches } from "@/actions/analytics";
import { AnalyticsClient } from "./analytics-client";
import { redirect } from "next/navigation";
import type { User } from "@/types/database";

export const metadata = {
  title: "Analytics — LK PharmaCare",
};

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.role === "admin" || user.role === "supervisor" || user.role === "super_admin";
  if (!isAdmin) redirect("/dashboard");

  const branches = await getAnalyticsBranches();

  // Attach branch name to user
  const userWithBranch = user as User & { branch?: { name: string } | null };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold font-[family-name:var(--font-sans)] text-white">
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Deep-dive insights — filter by period, date range &amp; branch
        </p>
      </div>

      <AnalyticsClient user={userWithBranch} branches={branches} />
    </div>
  );
}
