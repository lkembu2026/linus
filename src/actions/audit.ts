"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import type { AuditLog } from "@/types/database";

interface AuditFilters {
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function getAuditLogs(
  page = 1,
  limit = 50,
  filters?: AuditFilters,
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin")
    return { logs: [] as AuditLog[], total: 0 };

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("audit_logs")
    .select("*, user:users!audit_logs_user_id_fkey(full_name, email, role)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (filters?.action) {
    query = query.eq("action", filters.action);
  }
  if (filters?.userId) {
    query = query.eq("user_id", filters.userId);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
  }

  const { data, error, count } = await query.range(from, to);

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

export async function getAuditUsers() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return [];

  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .order("full_name");

  return (data ?? []) as { id: string; full_name: string }[];
}
