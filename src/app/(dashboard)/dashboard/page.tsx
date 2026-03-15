import { cookies } from "next/headers";
import { DashboardClient } from "./dashboard-client";
import { MODE_STORAGE_KEY } from "@/lib/mode";
import { resolveCurrentBranchMode } from "@/lib/mode-server";
import { getDashboardPageData } from "@/actions/dashboard";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const mode = await resolveCurrentBranchMode(
    cookieStore.get(MODE_STORAGE_KEY)?.value,
  );

  const initialData = await getDashboardPageData(mode);

  return (
    <div className="space-y-6">
      <DashboardClient initialData={initialData} initialMode={mode} />
    </div>
  );
}
