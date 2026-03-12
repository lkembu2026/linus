import { getCurrentUser } from "@/actions/auth";
import { getAuditLogs, getAuditUsers } from "@/actions/audit";
import { redirect } from "next/navigation";
import { AuditClient } from "./audit-client";
import { isAdminRole } from "@/types";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminRole(user.role)) redirect("/dashboard");

  const [{ logs, total }, users] = await Promise.all([
    getAuditLogs(),
    getAuditUsers(),
  ]);

  return <AuditClient initialLogs={logs} initialTotal={total} users={users} />;
}
