"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { getEffectiveBranchId } from "@/lib/branch-server";
import { MEDICINE_CATEGORIES } from "@/lib/constants";
import { getCategoriesForMode } from "@/lib/mode";
import type {
  DashboardStats,
  TopMedicine,
  RevenueDataPoint,
  BranchComparison,
  InventoryOverview,
  MedicineDailySales,
  MedicineCategoryBreakdown,
} from "@/types";
import type { AppMode } from "@/types";
import type { Medicine } from "@/types/database";

export type DashboardRecentSale = {
  id: string;
  receipt_number: string;
  total_amount: number;
  payment_method: string;
  is_voided: boolean;
  created_at: string;
  branch_id: string;
  cashier_id: string;
  voided_by: string | null;
  items_summary: string;
};

export type DashboardPageData = {
  stats: DashboardStats;
  topMedicines: TopMedicine[];
  revenueData: RevenueDataPoint[];
  lowStock: Medicine[];
  allMedicines: Medicine[];
  overview: InventoryOverview;
  dailySales: MedicineDailySales[];
  categoryBreakdown: MedicineCategoryBreakdown[];
  recentSales: DashboardRecentSale[];
  role: string;
};

type SaleAmount = {
  total_amount: number;
  created_at: string;
  branch_id: string;
};

// ── Shared context computed once per request ────────────────────────────────
type DashCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  branchId: string | null;
  /** undefined = no category filter; [] = filter matched nothing */
  validSaleIds: string[] | undefined;
  categories: string[];
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

async function getLegacyBeautyCategories(branchId?: string | null) {
  const supabase = await createClient();
  const medSet = new Set<string>(MEDICINE_CATEGORIES as readonly string[]);

  let query = supabase.from("medicines").select("category");
  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data } = await query;

  return [
    ...new Set(
      ((data ?? []) as { category: string | null }[])
        .map((item) => item.category)
        .filter(
          (category): category is string => !!category && !medSet.has(category),
        ),
    ),
  ];
}

export async function getDashboardPageData(
  mode: AppMode,
): Promise<DashboardPageData> {
  const [user, supabase] = await Promise.all([
    getCurrentUser(),
    createClient(),
  ]);
  const branchId = await getEffectiveBranchId(user);

  let categories = getCategoriesForMode(mode);

  const buildData = async (targetCategories: string[]) => {
    // Compute validSaleIds ONCE — previously computed 5× per request
    const validSaleIds =
      targetCategories.length > 0
        ? await getSaleIdsByCategories(supabase, targetCategories, branchId)
        : undefined;

    const ctx: DashCtx = {
      supabase,
      branchId,
      validSaleIds,
      categories: targetCategories,
    };

    // All queries run in parallel with shared context
    const [
      stats,
      topMedicines,
      revenueData,
      allMedicines,
      overview,
      dailySales,
      categoryBreakdown,
      recentSales,
    ] = await Promise.all([
      _getDashboardStats(ctx),
      _getTopMedicines(ctx, 10),
      _getRevenueChart(ctx, 30),
      _getAllMedicines(ctx),
      _getInventoryOverview(ctx),
      _getMedicineDailySales(ctx, 14),
      _getMedicineCategoryBreakdown(ctx),
      _getRecentSales(ctx, 10),
    ]);

    const lowStock = allMedicines.filter(
      (m) => m.quantity_in_stock <= m.reorder_level,
    );

    return {
      stats,
      topMedicines,
      revenueData,
      lowStock,
      allMedicines,
      overview,
      dailySales,
      categoryBreakdown,
      recentSales,
      role: user?.role ?? "cashier",
    };
  };

  let data = await buildData(categories);

  if (mode === "beauty" && (data.stats?.totalMedicines ?? 0) === 0) {
    const fallbackCategories = await getLegacyBeautyCategories(branchId);
    if (fallbackCategories.length > 0) {
      categories = fallbackCategories;
      data = await buildData(categories);
    }
  }

  return data;
}

// ── Stats ───────────────────────────────────────────────────────────────────
async function _getDashboardStats(ctx: DashCtx): Promise<DashboardStats> {
  const { supabase, branchId, validSaleIds, categories } = ctx;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Build sales-today query
  let salesQ = supabase
    .from("sales")
    .select("total_amount")
    .gte("created_at", today.toISOString())
    .eq("is_voided", false);
  if (branchId) salesQ = salesQ.eq("branch_id", branchId);
  if (validSaleIds !== undefined) {
    if (validSaleIds.length === 0) salesQ = salesQ.limit(0);
    else salesQ = salesQ.in("id", validSaleIds);
  }

  // Build month query
  let monthQ = supabase
    .from("sales")
    .select("total_amount")
    .gte("created_at", monthStart.toISOString())
    .eq("is_voided", false);
  if (branchId) monthQ = monthQ.eq("branch_id", branchId);
  if (validSaleIds !== undefined) {
    if (validSaleIds.length === 0) monthQ = monthQ.limit(0);
    else monthQ = monthQ.in("id", validSaleIds);
  }

  // Build medicines count query
  let medCountQ = supabase.from("medicines").select("id", { count: "exact" });
  if (branchId) medCountQ = medCountQ.eq("branch_id", branchId);
  if (categories.length > 0) medCountQ = medCountQ.in("category", categories);

  // Build low-stock query
  let lowStockQ = supabase
    .from("medicines")
    .select("quantity_in_stock, reorder_level");
  if (branchId) lowStockQ = lowStockQ.eq("branch_id", branchId);
  if (categories.length > 0) lowStockQ = lowStockQ.in("category", categories);

  // Fire all 4 in parallel
  const [
    { data: salesData },
    { data: monthData },
    { count: totalMedicines },
    { data: allMeds },
  ] = await Promise.all([salesQ, monthQ, medCountQ, lowStockQ]);

  const sales = (salesData ?? []) as unknown as { total_amount: number }[];
  const todaySales = sales.reduce((s, r) => s + (r.total_amount ?? 0), 0);

  const monthSales = (monthData ?? []) as unknown as {
    total_amount: number;
  }[];
  const monthRevenue = monthSales.reduce(
    (s, r) => s + (r.total_amount ?? 0),
    0,
  );

  const meds = (allMeds ?? []) as unknown as {
    quantity_in_stock: number;
    reorder_level: number;
  }[];
  const lowStockCount = meds.filter(
    (m) => m.quantity_in_stock <= m.reorder_level,
  ).length;

  return {
    totalRevenueToday: todaySales,
    totalRevenueMonth: monthRevenue,
    salesCountToday: sales.length,
    salesCountMonth: monthSales.length,
    lowStockCount,
    totalMedicines: totalMedicines ?? 0,
  };
}

// ── Top Medicines ───────────────────────────────────────────────────────────
async function _getTopMedicines(
  ctx: DashCtx,
  limit: number,
): Promise<TopMedicine[]> {
  const { supabase, branchId, validSaleIds } = ctx;

  if (validSaleIds !== undefined && validSaleIds.length === 0) return [];

  // Get completed sale IDs
  let salesQ = supabase.from("sales").select("id").eq("is_voided", false);
  if (branchId) salesQ = salesQ.eq("branch_id", branchId);
  if (validSaleIds !== undefined) salesQ = salesQ.in("id", validSaleIds);

  const { data: salesData } = await salesQ;
  const saleIds = ((salesData ?? []) as unknown as { id: string }[]).map(
    (s) => s.id,
  );
  if (saleIds.length === 0) return [];

  const { data: itemsData } = await supabase
    .from("sale_items")
    .select("medicine_id, quantity, unit_price")
    .in("sale_id", saleIds);

  const items = (itemsData ?? []) as unknown as {
    medicine_id: string;
    quantity: number;
    unit_price: number;
  }[];

  const medMap = new Map<string, { qty: number; revenue: number }>();
  for (const item of items) {
    const existing = medMap.get(item.medicine_id) ?? { qty: 0, revenue: 0 };
    existing.qty += item.quantity;
    existing.revenue += item.unit_price * item.quantity;
    medMap.set(item.medicine_id, existing);
  }

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

// ── Revenue Chart ───────────────────────────────────────────────────────────
async function _getRevenueChart(
  ctx: DashCtx,
  days: number,
): Promise<RevenueDataPoint[]> {
  const { supabase, branchId, validSaleIds } = ctx;

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

// ── Low Stock Items ─────────────────────────────────────────────────────────
async function _getAllMedicines(ctx: DashCtx) {
  const { supabase, branchId, categories } = ctx;

  let query = supabase
    .from("medicines")
    .select("*")
    .order("quantity_in_stock", { ascending: true });

  if (branchId) query = query.eq("branch_id", branchId);
  if (categories.length > 0) query = query.in("category", categories);

  const { data } = await query;
  return (data ?? []) as unknown as Medicine[];
}

// ── Inventory Overview ──────────────────────────────────────────────────────
async function _getInventoryOverview(ctx: DashCtx): Promise<InventoryOverview> {
  const { supabase, branchId, categories } = ctx;

  let q = supabase
    .from("medicines")
    .select("id, quantity_in_stock, reorder_level, created_at")
    .order("created_at", { ascending: false });
  if (branchId) q = q.eq("branch_id", branchId);
  if (categories.length > 0) q = q.in("category", categories);

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
async function _getMedicineDailySales(
  ctx: DashCtx,
  days: number,
): Promise<MedicineDailySales[]> {
  const { supabase, branchId, validSaleIds } = ctx;

  const emptyDays = (): MedicineDailySales[] => {
    const results: MedicineDailySales[] = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      results.push({
        date: d.toISOString().split("T")[0],
        units_sold: 0,
      });
    }
    return results;
  };

  if (validSaleIds !== undefined && validSaleIds.length === 0)
    return emptyDays();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let salesQ = supabase
    .from("sales")
    .select("id")
    .gte("created_at", startDate.toISOString())
    .eq("is_voided", false);
  if (branchId) salesQ = salesQ.eq("branch_id", branchId);
  if (validSaleIds !== undefined) salesQ = salesQ.in("id", validSaleIds);

  const { data: salesData } = await salesQ;
  const saleIds = ((salesData ?? []) as unknown as { id: string }[]).map(
    (s) => s.id,
  );
  if (saleIds.length === 0) return emptyDays();

  const { data: itemsData } = await supabase
    .from("sale_items")
    .select("quantity, sale_id, sales(created_at)")
    .in("sale_id", saleIds);

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
async function _getMedicineCategoryBreakdown(
  ctx: DashCtx,
): Promise<MedicineCategoryBreakdown[]> {
  const { supabase, branchId, categories } = ctx;

  let medQ = supabase
    .from("medicines")
    .select("id, category, quantity_in_stock");
  if (branchId) medQ = medQ.eq("branch_id", branchId);
  if (categories.length > 0) medQ = medQ.in("category", categories);

  let salesQ = supabase.from("sales").select("id").eq("is_voided", false);
  if (branchId) salesQ = salesQ.eq("branch_id", branchId);

  // Fetch meds + sales in parallel
  const [{ data: medsData }, { data: salesData }] = await Promise.all([
    medQ,
    salesQ,
  ]);

  const meds = (medsData ?? []) as unknown as {
    id: string;
    category: string;
    quantity_in_stock: number;
  }[];

  const stockMap = new Map<string, { stock: number; medIds: string[] }>();
  for (const m of meds) {
    const cat = m.category || "Uncategorised";
    const entry = stockMap.get(cat) ?? { stock: 0, medIds: [] };
    entry.stock += m.quantity_in_stock;
    entry.medIds.push(m.id);
    stockMap.set(cat, entry);
  }

  const allMedIds = meds.map((m) => m.id);
  if (allMedIds.length === 0) return [];

  const saleIds = ((salesData ?? []) as unknown as { id: string }[]).map(
    (s) => s.id,
  );

  const soldMap = new Map<string, number>();
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

// ── Recent Sales (inlined to avoid redundant auth/saleId lookups) ───────────
type RecentSale = {
  id: string;
  receipt_number: string;
  total_amount: number;
  payment_method: string;
  is_voided: boolean;
  created_at: string;
  branch_id: string;
  cashier_id: string;
  voided_by: string | null;
  items_summary: string;
};

async function _getRecentSales(
  ctx: DashCtx,
  limit: number,
): Promise<RecentSale[]> {
  const { supabase, branchId, validSaleIds } = ctx;

  if (validSaleIds !== undefined && validSaleIds.length === 0) return [];

  let query = supabase
    .from("sales")
    .select(
      "id, receipt_number, total_amount, payment_method, is_voided, created_at, branch_id, cashier_id, voided_by",
    )
    .order("created_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (validSaleIds !== undefined) query = query.in("id", validSaleIds);

  const { data: salesData } = await query.limit(limit);

  type Sale = {
    id: string;
    receipt_number: string;
    total_amount: number;
    payment_method: string;
    is_voided: boolean;
    created_at: string;
    branch_id: string;
    cashier_id: string;
    voided_by: string | null;
  };

  const sales = (salesData ?? []) as unknown as Sale[];
  if (sales.length === 0) return [];

  const saleIds = sales.map((s) => s.id);
  const { data: saleItemsData } = await supabase
    .from("sale_items")
    .select("sale_id, quantity, medicine_id")
    .in("sale_id", saleIds);

  type SaleItemRow = { sale_id: string; quantity: number; medicine_id: string };
  const saleItems = (saleItemsData ?? []) as unknown as SaleItemRow[];

  const medIds = [...new Set(saleItems.map((si) => si.medicine_id))];
  const { data: medsData } =
    medIds.length > 0
      ? await supabase.from("medicines").select("id, name").in("id", medIds)
      : { data: [] };
  const medsMap = new Map(
    ((medsData ?? []) as unknown as { id: string; name: string }[]).map((m) => [
      m.id,
      m.name,
    ]),
  );

  return sales.map((sale) => {
    const items = saleItems.filter((si) => si.sale_id === sale.id);
    const summary = items
      .map(
        (si) => `${medsMap.get(si.medicine_id) ?? "Unknown"} ×${si.quantity}`,
      )
      .join(", ");
    return { ...sale, items_summary: summary };
  });
}

// ── Public exports (kept for backward compatibility) ────────────────────────
export async function getDashboardStats(
  categories?: string[],
): Promise<DashboardStats> {
  const [user, supabase] = await Promise.all([
    getCurrentUser(),
    createClient(),
  ]);
  const branchId = await getEffectiveBranchId(user);
  const cats = categories ?? [];
  const validSaleIds =
    cats.length > 0
      ? await getSaleIdsByCategories(supabase, cats, branchId)
      : undefined;
  return _getDashboardStats({
    supabase,
    branchId,
    validSaleIds,
    categories: cats,
  });
}

export async function getTopMedicines(
  limit: number = 10,
  categories?: string[],
): Promise<TopMedicine[]> {
  const [user, supabase] = await Promise.all([
    getCurrentUser(),
    createClient(),
  ]);
  const branchId = await getEffectiveBranchId(user);
  const cats = categories ?? [];
  const validSaleIds =
    cats.length > 0
      ? await getSaleIdsByCategories(supabase, cats, branchId)
      : undefined;
  return _getTopMedicines(
    { supabase, branchId, validSaleIds, categories: cats },
    limit,
  );
}

export async function getRevenueChart(
  days: number = 30,
  categories?: string[],
): Promise<RevenueDataPoint[]> {
  const [user, supabase] = await Promise.all([
    getCurrentUser(),
    createClient(),
  ]);
  const branchId = await getEffectiveBranchId(user);
  const cats = categories ?? [];
  const validSaleIds =
    cats.length > 0
      ? await getSaleIdsByCategories(supabase, cats, branchId)
      : undefined;
  return _getRevenueChart(
    { supabase, branchId, validSaleIds, categories: cats },
    days,
  );
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
  const [user, supabase] = await Promise.all([
    getCurrentUser(),
    createClient(),
  ]);
  const branchId = await getEffectiveBranchId(user);
  const all = await _getAllMedicines({
    supabase,
    branchId,
    validSaleIds: undefined,
    categories: categories ?? [],
  });
  return all.filter((m) => m.quantity_in_stock <= m.reorder_level);
}

export async function getInventoryOverview(
  categories?: string[],
): Promise<InventoryOverview> {
  const [user, supabase] = await Promise.all([
    getCurrentUser(),
    createClient(),
  ]);
  const branchId = await getEffectiveBranchId(user);
  return _getInventoryOverview({
    supabase,
    branchId,
    validSaleIds: undefined,
    categories: categories ?? [],
  });
}

export async function getMedicineDailySales(
  days: number = 14,
  categories?: string[],
): Promise<MedicineDailySales[]> {
  const [user, supabase] = await Promise.all([
    getCurrentUser(),
    createClient(),
  ]);
  const branchId = await getEffectiveBranchId(user);
  const cats = categories ?? [];
  const validSaleIds =
    cats.length > 0
      ? await getSaleIdsByCategories(supabase, cats, branchId)
      : undefined;
  return _getMedicineDailySales(
    { supabase, branchId, validSaleIds, categories: cats },
    days,
  );
}

export async function getMedicineCategoryBreakdown(
  categories?: string[],
): Promise<MedicineCategoryBreakdown[]> {
  const [user, supabase] = await Promise.all([
    getCurrentUser(),
    createClient(),
  ]);
  const branchId = await getEffectiveBranchId(user);
  return _getMedicineCategoryBreakdown({
    supabase,
    branchId,
    validSaleIds: undefined,
    categories: categories ?? [],
  });
}
