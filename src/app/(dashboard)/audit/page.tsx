import { getCurrentUser } from "@/actions/auth";
import { getAuditLogs } from "@/actions/audit";
import { redirect } from "next/navigation";
import { AuditClient } from "./audit-client";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const { logs, total } = await getAuditLogs();

  return <AuditClient initialLogs={logs} initialTotal={total} />;
}
