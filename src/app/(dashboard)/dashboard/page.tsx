import { cookies } from "next/headers";
import { DashboardClient } from "./dashboard-client";
import { MODE_STORAGE_KEY, normalizeMode } from "@/lib/mode";
import { getDashboardPageData } from "@/actions/dashboard";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const mode = normalizeMode(cookieStore.get(MODE_STORAGE_KEY)?.value);
  const initialData = await getDashboardPageData(mode);

  return (
    <div className="space-y-6">
      <DashboardClient initialData={initialData} initialMode={mode} />
    </div>
  );
}
