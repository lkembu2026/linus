"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { getEffectiveBranchId } from "@/lib/branch-server";
import type {
  DashboardStats,
  TopMedicine,
  RevenueDataPoint,
  BranchComparison,
  InventoryOverview,
  MedicineDailySales,
  MedicineCategoryBreakdown,
} from "@/types";
import type { Medicine } from "@/types/database";

type SaleAmount = {
  total_amount: number;
  created_at: string;
  branch_id: string;
};

async function getSaleIdsByCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categories: string[],
  branchId?: string | null,
) {
  if (!categories.length) return undefined;

  let medsQuery = supabase
    .from("medicines")
    .select("id")
    .in("category", categories);

  if (branchId) {
    medsQuery = medsQuery.eq("branch_id", branchId);
  }

  const { data: medsData } = await medsQuery;
  const validMedIds = ((medsData ?? []) as unknown as { id: string }[]).map(
    (m) => m.id,
  );

  if (validMedIds.length === 0) return [];

  const CHUNK_SIZE = 100;
  const saleIdSet = new Set<string>();

  for (let i = 0; i < validMedIds.length; i += CHUNK_SIZE) {
    const chunk = validMedIds.slice(i, i + CHUNK_SIZE);
    const { data: saleItemsData } = await supabase
      .from("sale_items")
      .select("sale_id")
      .in("medicine_id", chunk);

    for (const row of (saleItemsData ?? []) as unknown as {
      sale_id: string;
    }[]) {
      saleIdSet.add(row.sale_id);
    }
  }

  return [...saleIdSet];
}

export async function getDashboardStats(
  categories?: string[],
): Promise<DashboardStats> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  const validSaleIds =
    categories && categories.length > 0
      ? await getSaleIdsByCategories(supabase, categories, branchId)
      : undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Total sales today
  let salesQuery = supabase
    .from("sales")
    .select("total_amount")
    .gte("created_at", today.toISOString())
    .eq("is_voided", false);

  if (branchId) salesQuery = salesQuery.eq("branch_id", branchId);
  if (validSaleIds !== undefined) {
    if (validSaleIds.length === 0) {
      salesQuery = salesQuery.limit(0);
    } else {
      salesQuery = salesQuery.in("id", validSaleIds);
    }
  }

  const { data: salesData } = await salesQuery;
  const sales = (salesData ?? []) as unknown as { total_amount: number }[];
  const todaySales = sales.reduce((s, r) => s + (r.total_amount ?? 0), 0);

  // Total medicines count
  let medQuery = supabase.from("medicines").select("id", { count: "exact" });
  if (branchId) medQuery = medQuery.eq("branch_id", branchId);
  if (categories && categories.length > 0)
    medQuery = medQuery.in("category", categories);
  const { count: totalMedicines } = await medQuery;

  // Low stock count
  const { data: allMeds } = await (async () => {
    let q = supabase
      .from("medicines")
      .select("quantity_in_stock, reorder_level");
    if (branchId) q = q.eq("branch_id", branchId);
    if (categories && categories.length > 0) q = q.in("category", categories);
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
  if (branchId) monthQuery = monthQuery.eq("branch_id", branchId);
  if (validSaleIds !== undefined) {
    if (validSaleIds.length === 0) {
      monthQuery = monthQuery.limit(0);
    } else {
      monthQuery = monthQuery.in("id", validSaleIds);
    }
  }
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
  categories?: string[],
): Promise<TopMedicine[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  const validSaleIdsByCategories =
    categories && categories.length > 0
      ? await getSaleIdsByCategories(supabase, categories, branchId)
      : undefined;

  if (
    validSaleIdsByCategories !== undefined &&
    validSaleIdsByCategories.length === 0
  )
    return [];

  // Get completed sales
  let salesQuery = supabase.from("sales").select("id").eq("is_voided", false);
  if (branchId) salesQuery = salesQuery.eq("branch_id", branchId);
  if (validSaleIdsByCategories !== undefined) {
    salesQuery = salesQuery.in("id", validSaleIdsByCategories);
  }
  const { data: salesData } = await salesQuery;
  const saleIds = ((salesData ?? []) as unknown as { id: string }[]).map(
    (s) => s.id,
  );

  if (saleIds.length === 0) return [];

  // Get sale items for those sales
  let itemsQuery = supabase
    .from("sale_items")
    .select("medicine_id, quantity, unit_price")
    .in("sale_id", saleIds);

  const { data: itemsData } = await itemsQuery;

  const items = (itemsData ?? []) as unknown as {
    medicine_id: string;
    quantity: number;
    unit_price: number;
  }[];

  // Aggregate by medicine
  const medMap = new Map<string, { qty: number; revenue: number }>();
  for (const item of items) {
    const existing = medMap.get(item.medicine_id) ?? { qty: 0, revenue: 0 };
    existing.qty += item.quantity;
    existing.revenue += item.unit_price * item.quantity;
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
  categories?: string[],
): Promise<RevenueDataPoint[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  const validSaleIds =
    categories && categories.length > 0
      ? await getSaleIdsByCategories(supabase, categories, branchId)
      : undefined;

  if (validSaleIds !== undefined && validSaleIds.length === 0) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from("sales")
    .select("total_amount, created_at")
    .gte("created_at", startDate.toISOString())
    .eq("is_voided", false)
    .order("created_at", { ascending: true });

  if (branchId) query = query.eq("branch_id", branchId);
  if (validSaleIds !== undefined) query = query.in("id", validSaleIds);

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

export async function getBranchComparison(
  categories?: string[],
): Promise<BranchComparison[]> {
  const supabase = await createClient();

  let validSaleIds: string[] | undefined;
  if (categories && categories.length > 0) {
    const { data: medsData } = await supabase
      .from("medicines")
      .select("id")
      .in("category", categories);
    const validMedIds = ((medsData ?? []) as unknown as { id: string }[]).map(
      (m) => m.id,
    );
    if (validMedIds.length === 0) validSaleIds = [];
    else {
      const { data: saleItemsData } = await supabase
        .from("sale_items")
        .select("sale_id")
        .in("medicine_id", validMedIds);
      validSaleIds = [
        ...new Set(
          ((saleItemsData ?? []) as unknown as { sale_id: string }[]).map(
            (si) => si.sale_id,
          ),
        ),
      ];
    }
  }

  const { data: branchesData } = await supabase
    .from("branches")
    .select("id, name");

  const branches = (branchesData ?? []) as unknown as {
    id: string;
    name: string;
  }[];

  const results: BranchComparison[] = [];

  for (const branch of branches) {
    let salesQuery = supabase
      .from("sales")
      .select("total_amount")
      .eq("branch_id", branch.id)
      .eq("is_voided", false);

    if (validSaleIds !== undefined) {
      if (validSaleIds.length === 0) {
        salesQuery = salesQuery.limit(0);
      } else {
        salesQuery = salesQuery.in("id", validSaleIds);
      }
    }

    const { data: salesData } = await salesQuery;

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

export async function getLowStockItems(categories?: string[]) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  let query = supabase
    .from("medicines")
    .select("*")
    .order("quantity_in_stock", { ascending: true });

  if (branchId) query = query.eq("branch_id", branchId);
  if (categories && categories.length > 0)
    query = query.in("category", categories);

  const { data } = await query;
  const medicines = (data ?? []) as unknown as Medicine[];

  return medicines.filter((m) => m.quantity_in_stock <= m.reorder_level);
}

// ── Inventory Overview ──────────────────────────────────────────────────────
export async function getInventoryOverview(
  categories?: string[],
): Promise<InventoryOverview> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  let q = supabase
    .from("medicines")
    .select("id, quantity_in_stock, reorder_level, created_at")
    .order("created_at", { ascending: false });
  if (branchId) q = q.eq("branch_id", branchId);
  if (categories && categories.length > 0) q = q.in("category", categories);

  const { data } = await q;
  const meds = (data ?? []) as unknown as {
    id: string;
    quantity_in_stock: number;
    reorder_level: number;
    created_at: string;
  }[];

  const total = meds.length;
  const out_of_stock = meds.filter((m) => m.quantity_in_stock === 0).length;
  const low_stock = meds.filter(
    (m) => m.quantity_in_stock > 0 && m.quantity_in_stock <= m.reorder_level,
  ).length;
  const in_stock = total - low_stock - out_of_stock;

  // Group additions by date (last 30 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const dateMap = new Map<string, number>();
  for (const m of meds) {
    const d = new Date(m.created_at);
    if (d >= cutoff) {
      const key = d.toISOString().split("T")[0];
      dateMap.set(key, (dateMap.get(key) ?? 0) + 1);
    }
  }
  const recently_added = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return { total, in_stock, low_stock, out_of_stock, recently_added };
}

// ── Medicine Units Sold Per Day ─────────────────────────────────────────────
export async function getMedicineDailySales(
  days: number = 14,
  categories?: string[],
): Promise<MedicineDailySales[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  const validSaleIdsByCategories =
    categories && categories.length > 0
      ? await getSaleIdsByCategories(supabase, categories, branchId)
      : undefined;

  if (
    validSaleIdsByCategories !== undefined &&
    validSaleIdsByCategories.length === 0
  ) {
    const results: MedicineDailySales[] = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      results.push({ date: key, units_sold: 0 });
    }
    return results;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let salesQ = supabase
    .from("sales")
    .select("id")
    .gte("created_at", startDate.toISOString())
    .eq("is_voided", false);
  if (branchId) salesQ = salesQ.eq("branch_id", branchId);
  if (validSaleIdsByCategories !== undefined) {
    salesQ = salesQ.in("id", validSaleIdsByCategories);
  }
  const { data: salesData } = await salesQ;
  const saleIds = ((salesData ?? []) as unknown as { id: string }[]).map(
    (s) => s.id,
  );
  if (saleIds.length === 0) {
    const results: MedicineDailySales[] = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      results.push({ date: key, units_sold: 0 });
    }
    return results;
  }

  // Get sale items with sale date
  let itemsQuery = supabase
    .from("sale_items")
    .select("quantity, sale_id, sales(created_at)")
    .in("sale_id", saleIds);

  const { data: itemsData } = await itemsQuery;

  const items = (itemsData ?? []) as unknown as {
    quantity: number;
    sales: { created_at: string } | null;
  }[];

  const dateMap = new Map<string, number>();
  for (const item of items) {
    const rawDate = item.sales?.created_at;
    if (!rawDate) continue;
    const key = new Date(rawDate).toISOString().split("T")[0];
    dateMap.set(key, (dateMap.get(key) ?? 0) + item.quantity);
  }

  // Fill missing days with 0
  const results: MedicineDailySales[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    results.push({ date: key, units_sold: dateMap.get(key) ?? 0 });
  }
  return results;
}

// ── Medicine Sales + Stock by Category ─────────────────────────────────────
export async function getMedicineCategoryBreakdown(
  categories?: string[],
): Promise<MedicineCategoryBreakdown[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  // All medicines with stock
  let medQ = supabase
    .from("medicines")
    .select("id, category, quantity_in_stock");
  if (branchId) medQ = medQ.eq("branch_id", branchId);
  if (categories && categories.length > 0)
    medQ = medQ.in("category", categories);
  const { data: medsData } = await medQ;
  const meds = (medsData ?? []) as unknown as {
    id: string;
    category: string;
    quantity_in_stock: number;
  }[];

  // Aggregate remaining stock by category
  const stockMap = new Map<string, { stock: number; medIds: string[] }>();
  for (const m of meds) {
    const cat = m.category || "Uncategorised";
    const entry = stockMap.get(cat) ?? { stock: 0, medIds: [] };
    entry.stock += m.quantity_in_stock;
    entry.medIds.push(m.id);
    stockMap.set(cat, entry);
  }

  // Sale items for all these medicines (all time)
  const allMedIds = meds.map((m) => m.id);
  if (allMedIds.length === 0) return [];

  // Filter to non-voided sales first
  let salesQ = supabase.from("sales").select("id").eq("is_voided", false);
  if (branchId) salesQ = salesQ.eq("branch_id", branchId);
  const { data: salesData } = await salesQ;
  const saleIds = ((salesData ?? []) as unknown as { id: string }[]).map(
    (s) => s.id,
  );

  const soldMap = new Map<string, number>(); // medId -> total qty sold
  if (saleIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("sale_items")
      .select("medicine_id, quantity")
      .in("sale_id", saleIds)
      .in("medicine_id", allMedIds);
    for (const item of (itemsData ?? []) as unknown as {
      medicine_id: string;
      quantity: number;
    }[]) {
      soldMap.set(
        item.medicine_id,
        (soldMap.get(item.medicine_id) ?? 0) + item.quantity,
      );
    }
  }

  // Aggregate sold by category
  const soldByCategory = new Map<string, number>();
  for (const m of meds) {
    const cat = m.category || "Uncategorised";
    soldByCategory.set(
      cat,
      (soldByCategory.get(cat) ?? 0) + (soldMap.get(m.id) ?? 0),
    );
  }

  return Array.from(stockMap.entries())
    .map(([category, { stock }]) => ({
      category,
      units_sold: soldByCategory.get(category) ?? 0,
      remaining_stock: stock,
    }))
    .sort((a, b) => b.remaining_stock - a.remaining_stock);
}
