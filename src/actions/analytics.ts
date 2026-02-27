"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import type {
  AnalyticsFilters,
  AnalyticsOverview,
  SalesBreakdown,
  InventoryHealth,
  MedicinePerformance,
} from "@/types";

// ── Date range helpers ───────────────────────────────────────────────────────
function buildRange(filters: AnalyticsFilters): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);

  switch (filters.period) {
    case "today":
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      break;
    case "week":
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
    case "month":
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case "quarter":
      from.setMonth(from.getMonth() - 2);
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      to.setTime(new Date(filters.dateTo).setHours(23, 59, 59, 999));
      break;
  }
  return { from, to };
}

// ── Overview ─────────────────────────────────────────────────────────────────
export async function getAnalyticsOverview(
  filters: AnalyticsFilters,
): Promise<AnalyticsOverview> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const branchId =
    isAdmin && filters.branchId ? filters.branchId : user?.branch_id;
  const { from, to } = buildRange(filters);

  // Sales in range
  let q = supabase
    .from("sales")
    .select("id, total_amount, created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .eq("is_voided", false);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data: salesData } = await q;
  const sales = (salesData ?? []) as { id: string; total_amount: number; created_at: string }[];

  const saleIds = sales.map((s) => s.id);
  const totalRevenue = sales.reduce((s, r) => s + r.total_amount, 0);
  const totalSales = sales.length;
  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  // Sale items for profit calc
  let totalCost = 0;
  let totalUnitsSold = 0;
  if (saleIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("sale_items")
      .select("quantity, unit_price, medicine_id")
      .in("sale_id", saleIds);
    const items = (itemsData ?? []) as {
      quantity: number;
      unit_price: number;
      medicine_id: string;
    }[];

    totalUnitsSold = items.reduce((s, i) => s + i.quantity, 0);

    // Get cost prices
    const medIds = [...new Set(items.map((i) => i.medicine_id))];
    if (medIds.length > 0) {
      const { data: medsData } = await supabase
        .from("medicines")
        .select("id, cost_price")
        .in("id", medIds);
      const costMap = new Map(
        ((medsData ?? []) as { id: string; cost_price: number }[]).map((m) => [
          m.id,
          m.cost_price,
        ]),
      );
      for (const item of items) {
        totalCost += (costMap.get(item.medicine_id) ?? 0) * item.quantity;
      }
    }
  }

  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Revenue + profit by day
  const dayMap = new Map<string, { revenue: number; cost: number }>();
  for (const sale of sales) {
    const key = new Date(sale.created_at).toISOString().split("T")[0];
    const entry = dayMap.get(key) ?? { revenue: 0, cost: 0 };
    entry.revenue += sale.total_amount;
    dayMap.set(key, entry);
  }

  // Fill dates
  const revenueByDay: { date: string; revenue: number; profit: number }[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    const key = cursor.toISOString().split("T")[0];
    const entry = dayMap.get(key) ?? { revenue: 0, cost: 0 };
    revenueByDay.push({
      date: key,
      revenue: Math.round(entry.revenue),
      profit: Math.round(entry.revenue - entry.cost),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    totalRevenue,
    totalSales,
    avgOrderValue,
    totalUnitsSold,
    totalProfit,
    profitMargin,
    revenueByDay,
  };
}

// ── Sales Breakdown ───────────────────────────────────────────────────────────
export async function getAnalyticsSalesBreakdown(
  filters: AnalyticsFilters,
): Promise<SalesBreakdown> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const branchId =
    isAdmin && filters.branchId ? filters.branchId : user?.branch_id;
  const { from, to } = buildRange(filters);

  let q = supabase
    .from("sales")
    .select("total_amount, payment_method, created_at, cashier_id, users(full_name)")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .eq("is_voided", false);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  const rows = (data ?? []) as {
    total_amount: number;
    payment_method: string;
    created_at: string;
    cashier_id: string;
    users: { full_name: string } | null;
  }[];

  // By payment method
  const pmMap = new Map<string, { count: number; amount: number }>();
  for (const r of rows) {
    const m = r.payment_method || "cash";
    const e = pmMap.get(m) ?? { count: 0, amount: 0 };
    e.count++;
    e.amount += r.total_amount;
    pmMap.set(m, e);
  }
  const byPaymentMethod = Array.from(pmMap.entries()).map(
    ([method, { count, amount }]) => ({ method, count, amount }),
  );

  // By hour of day
  const hourMap = new Map<number, { count: number; amount: number }>();
  for (const r of rows) {
    const h = new Date(r.created_at).getHours();
    const e = hourMap.get(h) ?? { count: 0, amount: 0 };
    e.count++;
    e.amount += r.total_amount;
    hourMap.set(h, e);
  }
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const e = hourMap.get(h) ?? { count: 0, amount: 0 };
    return {
      hour: h < 12 ? `${h === 0 ? 12 : h}am` : `${h === 12 ? 12 : h - 12}pm`,
      count: e.count,
      amount: Math.round(e.amount),
    };
  }).filter((_, i) => i >= 6 && i <= 22); // 6am–10pm

  // By day of week
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowMap = new Map<number, { count: number; amount: number }>();
  for (const r of rows) {
    const d = new Date(r.created_at).getDay();
    const e = dowMap.get(d) ?? { count: 0, amount: 0 };
    e.count++;
    e.amount += r.total_amount;
    dowMap.set(d, e);
  }
  const byDayOfWeek = DAYS.map((day, i) => {
    const e = dowMap.get(i) ?? { count: 0, amount: 0 };
    return { day, count: e.count, amount: Math.round(e.amount) };
  });

  // By cashier
  const cashierMap = new Map<string, { name: string; count: number; amount: number }>();
  for (const r of rows) {
    const name = r.users?.full_name ?? "Unknown";
    const key = r.cashier_id ?? name;
    const e = cashierMap.get(key) ?? { name, count: 0, amount: 0 };
    e.count++;
    e.amount += r.total_amount;
    cashierMap.set(key, e);
  }
  const byCashier = Array.from(cashierMap.values()).sort(
    (a, b) => b.amount - a.amount,
  );

  return { byPaymentMethod, byHour, byDayOfWeek, byCashier };
}

// ── Inventory Health ──────────────────────────────────────────────────────────
export async function getAnalyticsInventoryHealth(
  branchId?: string,
): Promise<InventoryHealth> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const effectiveBranchId = isAdmin && branchId ? branchId : user?.branch_id;

  let q = supabase
    .from("medicines")
    .select(
      "id, name, category, unit_price, cost_price, quantity_in_stock, expiry_date",
    );
  if (effectiveBranchId) q = q.eq("branch_id", effectiveBranchId);
  const { data } = await q;
  const meds = (data ?? []) as {
    id: string;
    name: string;
    category: string;
    unit_price: number;
    cost_price: number;
    quantity_in_stock: number;
    expiry_date: string | null;
  }[];

  const totalStockValue = meds.reduce(
    (s, m) => s + m.unit_price * m.quantity_in_stock,
    0,
  );
  const totalCostValue = meds.reduce(
    (s, m) => s + m.cost_price * m.quantity_in_stock,
    0,
  );
  const totalUnits = meds.reduce((s, m) => s + m.quantity_in_stock, 0);
  const potentialProfit = totalStockValue - totalCostValue;

  // Category summary
  const catMap = new Map<string, { units: number; value: number; cost: number }>();
  for (const m of meds) {
    const cat = m.category || "Uncategorised";
    const e = catMap.get(cat) ?? { units: 0, value: 0, cost: 0 };
    e.units += m.quantity_in_stock;
    e.value += m.unit_price * m.quantity_in_stock;
    e.cost += m.cost_price * m.quantity_in_stock;
    catMap.set(cat, e);
  }
  const categorySummary = Array.from(catMap.entries())
    .map(([category, { units, value, cost }]) => ({ category, units, value, cost }))
    .sort((a, b) => b.value - a.value);

  // Near expiry (within 90 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 90);
  const nearExpiry = meds
    .filter((m) => m.expiry_date && new Date(m.expiry_date) <= cutoff && m.quantity_in_stock > 0)
    .sort(
      (a, b) =>
        new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime(),
    )
    .slice(0, 20)
    .map((m) => ({
      name: m.name,
      expiry_date: m.expiry_date!,
      quantity_in_stock: m.quantity_in_stock,
      category: m.category,
    }));

  return {
    totalStockValue,
    totalCostValue,
    potentialProfit,
    totalUnits,
    categorySummary,
    nearExpiry,
  };
}

// ── Medicine Performance ──────────────────────────────────────────────────────
export async function getAnalyticsMedicinePerformance(
  filters: AnalyticsFilters,
): Promise<MedicinePerformance> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const branchId =
    isAdmin && filters.branchId ? filters.branchId : user?.branch_id;
  const { from, to } = buildRange(filters);

  // Sales in range
  let salesQ = supabase
    .from("sales")
    .select("id")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .eq("is_voided", false);
  if (branchId) salesQ = salesQ.eq("branch_id", branchId);
  const { data: salesData } = await salesQ;
  const saleIds = ((salesData ?? []) as { id: string }[]).map((s) => s.id);

  // All medicines for this branch
  let medQ = supabase.from("medicines").select("id, name, category, quantity_in_stock");
  if (branchId) medQ = medQ.eq("branch_id", branchId);
  const { data: medsData } = await medQ;
  const allMeds = (medsData ?? []) as {
    id: string;
    name: string;
    category: string;
    quantity_in_stock: number;
  }[];

  if (saleIds.length === 0) {
    return {
      topSellers: [],
      slowMovers: allMeds
        .filter((m) => m.quantity_in_stock > 0)
        .slice(0, 10)
        .map((m) => ({ name: m.name, category: m.category, quantity_in_stock: m.quantity_in_stock })),
      categoryPerformance: [],
    };
  }

  // Sale items
  const { data: itemsData } = await supabase
    .from("sale_items")
    .select("medicine_id, quantity, unit_price")
    .in("sale_id", saleIds);
  const items = (itemsData ?? []) as {
    medicine_id: string;
    quantity: number;
    unit_price: number;
  }[];

  // Aggregate by medicine
  const soldMap = new Map<string, { qty: number; revenue: number }>();
  for (const item of items) {
    const e = soldMap.get(item.medicine_id) ?? { qty: 0, revenue: 0 };
    e.qty += item.quantity;
    e.revenue += item.unit_price * item.quantity;
    soldMap.set(item.medicine_id, e);
  }

  const medsById = new Map(allMeds.map((m) => [m.id, m]));

  const topSellers = Array.from(soldMap.entries())
    .map(([id, { qty, revenue }]) => {
      const m = medsById.get(id);
      return {
        name: m?.name ?? "Unknown",
        category: m?.category ?? "-",
        units_sold: qty,
        revenue,
      };
    })
    .sort((a, b) => b.units_sold - a.units_sold)
    .slice(0, 15);

  const soldIds = new Set(soldMap.keys());
  const slowMovers = allMeds
    .filter((m) => !soldIds.has(m.id) && m.quantity_in_stock > 0)
    .slice(0, 15)
    .map((m) => ({
      name: m.name,
      category: m.category,
      quantity_in_stock: m.quantity_in_stock,
    }));

  // Category performance
  const catMap = new Map<string, { units_sold: number; revenue: number }>();
  for (const [id, { qty, revenue }] of soldMap.entries()) {
    const m = medsById.get(id);
    const cat = m?.category ?? "Uncategorised";
    const e = catMap.get(cat) ?? { units_sold: 0, revenue: 0 };
    e.units_sold += qty;
    e.revenue += revenue;
    catMap.set(cat, e);
  }
  const categoryPerformance = Array.from(catMap.entries())
    .map(([category, { units_sold, revenue }]) => ({ category, units_sold, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  return { topSellers, slowMovers, categoryPerformance };
}

// ── Branch list for filter ────────────────────────────────────────────────────
export async function getAnalyticsBranches() {
  const supabase = await createClient();
  const { data } = await supabase.from("branches").select("id, name").order("name");
  return (data ?? []) as { id: string; name: string }[];
}
