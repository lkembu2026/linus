import { getCurrentUser } from "@/actions/auth";
import { getReportAutomationSettings } from "@/actions/reports";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const reportSettings = await getReportAutomationSettings();

  return <SettingsClient user={user} initialReportSettings={reportSettings} />;
}
