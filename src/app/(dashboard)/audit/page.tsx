import { getCurrentUser } from "@/actions/auth";
import { getAuditLogs, getAuditUsers } from "@/actions/audit";
import { redirect } from "next/navigation";
import { AuditClient } from "./audit-client";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const [{ logs, total }, users] = await Promise.all([
    getAuditLogs(),
    getAuditUsers(),
  ]);

  return <AuditClient initialLogs={logs} initialTotal={total} users={users} />;
}
