"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import type {
  DashboardStats,
  TopMedicine,
  RevenueDataPoint,
  BranchComparison,
} from "@/types";
import type { Medicine } from "@/types/database";

type SaleAmount = {
  total_amount: number;
  created_at: string;
  branch_id: string;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = user?.branch_id;
  const isAdmin = user?.role === "admin";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Total sales today
  let salesQuery = supabase
    .from("sales")
    .select("total_amount")
    .gte("created_at", today.toISOString())
    .eq("is_voided", false);

  if (!isAdmin && branchId) salesQuery = salesQuery.eq("branch_id", branchId);

  const { data: salesData } = await salesQuery;
  const sales = (salesData ?? []) as unknown as { total_amount: number }[];
  const todaySales = sales.reduce((s, r) => s + (r.total_amount ?? 0), 0);

  // Total medicines count
  let medQuery = supabase.from("medicines").select("id", { count: "exact" });
  if (!isAdmin && branchId) medQuery = medQuery.eq("branch_id", branchId);
  const { count: totalMedicines } = await medQuery;

  // Low stock count
  const { data: allMeds } = await (async () => {
    let q = supabase
      .from("medicines")
      .select("quantity_in_stock, reorder_level");
    if (!isAdmin && branchId) q = q.eq("branch_id", branchId);
    return q;
  })();
  const meds = (allMeds ?? []) as unknown as {
    quantity_in_stock: number;
    reorder_level: number;
  }[];
  const lowStockCount = meds.filter(
    (m) => m.quantity_in_stock <= m.reorder_level,
  ).length;

  // Monthly sales
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  let monthQuery = supabase
    .from("sales")
    .select("total_amount")
    .gte("created_at", monthStart.toISOString())
    .eq("is_voided", false);
  if (!isAdmin && branchId) monthQuery = monthQuery.eq("branch_id", branchId);
  const { data: monthData } = await monthQuery;
  const monthSales = (monthData ?? []) as unknown as { total_amount: number }[];
  const monthRevenue = monthSales.reduce(
    (s, r) => s + (r.total_amount ?? 0),
    0,
  );

  return {
    totalRevenueToday: todaySales,
    totalRevenueMonth: monthRevenue,
    salesCountToday: sales.length,
    salesCountMonth: monthSales.length,
    lowStockCount: lowStockCount,
    totalMedicines: totalMedicines ?? 0,
  };
}

export async function getTopMedicines(
  limit: number = 10,
): Promise<TopMedicine[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = user?.branch_id;
  const isAdmin = user?.role === "admin";

  // Get completed sales
  let salesQuery = supabase.from("sales").select("id").eq("is_voided", false);
  if (!isAdmin && branchId) salesQuery = salesQuery.eq("branch_id", branchId);
  const { data: salesData } = await salesQuery;
  const saleIds = ((salesData ?? []) as unknown as { id: string }[]).map(
    (s) => s.id,
  );

  if (saleIds.length === 0) return [];

  // Get sale items for those sales
  const { data: itemsData } = await supabase
    .from("sale_items")
    .select("medicine_id, quantity, total_price")
    .in("sale_id", saleIds);

  const items = (itemsData ?? []) as unknown as {
    medicine_id: string;
    quantity: number;
    total_price: number;
  }[];

  // Aggregate by medicine
  const medMap = new Map<string, { qty: number; revenue: number }>();
  for (const item of items) {
    const existing = medMap.get(item.medicine_id) ?? { qty: 0, revenue: 0 };
    existing.qty += item.quantity;
    existing.revenue += item.total_price;
    medMap.set(item.medicine_id, existing);
  }

  // Get medicine names
  const medIds = Array.from(medMap.keys());
  if (medIds.length === 0) return [];

  const { data: medsData } = await supabase
    .from("medicines")
    .select("id, name")
    .in("id", medIds);

  const medsById = new Map(
    ((medsData ?? []) as unknown as { id: string; name: string }[]).map((m) => [
      m.id,
      m.name,
    ]),
  );

  const results: TopMedicine[] = [];
  for (const [medId, agg] of medMap.entries()) {
    results.push({
      medicine_id: medId,
      medicine_name: medsById.get(medId) ?? "Unknown",
      total_quantity: agg.qty,
      total_revenue: agg.revenue,
    });
  }

  return results
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, limit);
}

export async function getRevenueChart(
  days: number = 30,
): Promise<RevenueDataPoint[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = user?.branch_id;
  const isAdmin = user?.role === "admin";

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from("sales")
    .select("total_amount, created_at")
    .gte("created_at", startDate.toISOString())
    .eq("is_voided", false)
    .order("created_at", { ascending: true });

  if (!isAdmin && branchId) query = query.eq("branch_id", branchId);

  const { data } = await query;
  const rows = (data ?? []) as unknown as SaleAmount[];

  // Group by date
  const dateMap = new Map<string, number>();
  for (const row of rows) {
    const date = new Date(row.created_at).toISOString().split("T")[0];
    dateMap.set(date, (dateMap.get(date) ?? 0) + row.total_amount);
  }

  return Array.from(dateMap.entries()).map(([date, revenue]) => ({
    date,
    revenue,
  }));
}

export async function getBranchComparison(): Promise<BranchComparison[]> {
  const supabase = await createClient();

  const { data: branchesData } = await supabase
    .from("branches")
    .select("id, name");

  const branches = (branchesData ?? []) as unknown as {
    id: string;
    name: string;
  }[];

  const results: BranchComparison[] = [];

  for (const branch of branches) {
    const { data: salesData } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("branch_id", branch.id)
      .eq("is_voided", false);

    const sales = (salesData ?? []) as unknown as { total_amount: number }[];
    const totalRevenue = sales.reduce((s, r) => s + (r.total_amount ?? 0), 0);

    results.push({
      branch_id: branch.id,
      branch_name: branch.name,
      revenue: totalRevenue,
      sales_count: sales.length,
    });
  }

  return results;
}

export async function getLowStockItems() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = user?.branch_id;
  const isAdmin = user?.role === "admin";

  let query = supabase
    .from("medicines")
    .select("*")
    .order("quantity_in_stock", { ascending: true });

  if (!isAdmin && branchId) query = query.eq("branch_id", branchId);

  const { data } = await query;
  const medicines = (data ?? []) as unknown as Medicine[];

  return medicines.filter((m) => m.quantity_in_stock <= m.reorder_level);
}
