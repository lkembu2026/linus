"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import type { AuditLog } from "@/types/database";

export async function getAuditLogs(page = 1, limit = 50) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin")
    return { logs: [] as AuditLog[], total: 0 };

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("audit_logs")
    .select("*, user:users!audit_logs_user_id_fkey(full_name, email, role)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("getAuditLogs error:", error);
    return { logs: [] as AuditLog[], total: 0 };
  }

  return {
    logs: (data ?? []) as unknown as (AuditLog & {
      user: { full_name: string; email: string; role: string } | null;
    })[],
    total: count ?? 0,
  };
}
