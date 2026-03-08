import { cookies } from "next/headers";
import { DashboardClient } from "./dashboard-client";
import { MODE_STORAGE_KEY, normalizeMode } from "@/lib/mode";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const mode = normalizeMode(cookieStore.get(MODE_STORAGE_KEY)?.value);

  return (
    <div className="space-y-6">
      <DashboardClient initialMode={mode} />
    </div>
  );
}
