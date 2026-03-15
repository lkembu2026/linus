"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";
import { getEffectiveBranchId } from "@/lib/branch-server";
import type { ImportInvoice } from "@/types";

export async function getImportInvoices(page = 1, pageSize = 20) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { invoices: [], total: 0 };

  const branchId = await getEffectiveBranchId(user);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("import_invoices")
    .select("*, users!imported_by(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("getImportInvoices error:", error);
    return { invoices: [], total: 0 };
  }

  const invoices = (
    (data ?? []) as unknown as (ImportInvoice & {
      users?: { full_name: string };
    })[]
  ).map((inv) => ({
    ...inv,
    imported_by_name: inv.users?.full_name ?? "Unknown",
  }));

  return { invoices, total: count ?? 0 };
}
