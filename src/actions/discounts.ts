"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { getEffectiveBranchId } from "@/lib/branch-server";

export interface DiscountedSaleItem {
  id: string;
  sale_id: string;
  medicine_id: string;
  medicine_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  final_total: number;
  receipt_number: string;
  cashier_name: string;
  sale_date: string;
  payment_method: string;
}

export async function getDiscountedSales(opts?: {
  page?: number;
  limit?: number;
}): Promise<{ items: DiscountedSaleItem[]; total: number }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { items: [], total: 0 };

  const branchId = await getEffectiveBranchId(user);
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Get discounted sale items joined with sales and medicines
  const { data, error, count } = await supabase
    .from("sale_items")
    .select(
      `
      id,
      sale_id,
      medicine_id,
      quantity,
      unit_price,
      discount_percent,
      sale:sales!inner(id, receipt_number, cashier_id, payment_method, created_at, branch_id, is_voided, cashier:users!sales_cashier_id_fkey(full_name))
    `,
      { count: "exact" },
    )
    .gt("discount_percent", 0)
    .eq("sale.branch_id", branchId)
    .eq("sale.is_voided", false)
    .order("sale_id", { ascending: false })
    .range(from, to);

  if (error || !data) return { items: [], total: 0 };

  const items: DiscountedSaleItem[] = (data as any[]).map((row: any) => {
    const lineTotal = row.unit_price * row.quantity;
    const discountAmount = lineTotal * (row.discount_percent / 100);
    return {
      id: row.id,
      sale_id: row.sale_id,
      medicine_id: row.medicine_id,
      medicine_name: "",
      quantity: row.quantity,
      unit_price: row.unit_price,
      discount_percent: row.discount_percent,
      discount_amount: discountAmount,
      final_total: lineTotal - discountAmount,
      receipt_number: row.sale?.receipt_number ?? "",
      cashier_name: row.sale?.cashier?.full_name ?? "Staff",
      sale_date: row.sale?.created_at ?? "",
      payment_method: row.sale?.payment_method ?? "",
    };
  });

  // Fetch medicine names
  const medIds = [...new Set(items.map((i) => i.medicine_id))];
  if (medIds.length > 0) {
    const { data: meds } = await supabase
      .from("medicines")
      .select("id, name")
      .in("id", medIds);
    const nameMap = new Map(
      ((meds ?? []) as { id: string; name: string }[]).map((m) => [
        m.id,
        m.name,
      ]),
    );
    for (const item of items) {
      item.medicine_name = nameMap.get(item.medicine_id) ?? "Unknown";
    }
  }

  return { items, total: count ?? 0 };
}
