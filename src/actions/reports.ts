"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { sendReportEmail } from "@/lib/email";

type SaleRow = {
  id: string;
  total_amount: number;
  payment_method: string;
  is_voided: boolean;
  created_at: string;
};

type SaleItemRow = {
  medicine_id: string;
  quantity: number;
  unit_price: number;
};

export async function getDailySalesReport(date: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { sales: [], summary: null };

  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  let query = supabase
    .from("sales")
    .select(
      "id, total_amount, payment_method, is_voided, created_at, receipt_number",
    )
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .order("created_at", { ascending: false });

  if (user.role !== "admin") {
    query = query.eq("branch_id", user.branch_id!);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getDailySalesReport error:", error);
    return { sales: [], summary: null };
  }

  const sales = (data ?? []) as unknown as SaleRow[];

  const activeSales = sales.filter((s) => !s.is_voided);
  const voidedSales = sales.filter((s) => s.is_voided);

  const summary = {
    totalSales: activeSales.length,
    totalRevenue: activeSales.reduce((sum, s) => sum + s.total_amount, 0),
    totalVoided: voidedSales.length,
    voidedAmount: voidedSales.reduce((sum, s) => sum + s.total_amount, 0),
    paymentBreakdown: activeSales.reduce(
      (acc, s) => {
        acc[s.payment_method] = (acc[s.payment_method] || 0) + s.total_amount;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  return { sales, summary };
}

export async function getMonthlySalesReport(year: number, month: number) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { dailyData: [], summary: null };

  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59`;

  let query = supabase
    .from("sales")
    .select("total_amount, payment_method, is_voided, created_at")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (user.role !== "admin") {
    query = query.eq("branch_id", user.branch_id!);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getMonthlySalesReport error:", error);
    return { dailyData: [], summary: null };
  }

  const sales = (data ?? []) as unknown as SaleRow[];
  const activeSales = sales.filter((s) => !s.is_voided);

  // Group by day
  const dailyMap = new Map<
    string,
    { date: string; revenue: number; count: number }
  >();
  for (const sale of activeSales) {
    const day = sale.created_at.slice(0, 10);
    const existing = dailyMap.get(day) || { date: day, revenue: 0, count: 0 };
    existing.revenue += sale.total_amount;
    existing.count += 1;
    dailyMap.set(day, existing);
  }

  const dailyData = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const summary = {
    totalSales: activeSales.length,
    totalRevenue: activeSales.reduce((sum, s) => sum + s.total_amount, 0),
    avgDailyRevenue:
      dailyData.length > 0
        ? activeSales.reduce((sum, s) => sum + s.total_amount, 0) /
          dailyData.length
        : 0,
    paymentBreakdown: activeSales.reduce(
      (acc, s) => {
        acc[s.payment_method] = (acc[s.payment_method] || 0) + s.total_amount;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  return { dailyData, summary };
}

export async function getTopSellingReport(
  startDate: string,
  endDate: string,
  limit = 20,
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  // Get non-voided sale IDs in date range
  let salesQuery = supabase
    .from("sales")
    .select("id")
    .eq("is_voided", false)
    .gte("created_at", `${startDate}T00:00:00`)
    .lte("created_at", `${endDate}T23:59:59`);

  if (user.role !== "admin") {
    salesQuery = salesQuery.eq("branch_id", user.branch_id!);
  }

  const { data: salesData } = await salesQuery;
  const sales = (salesData ?? []) as unknown as { id: string }[];
  if (sales.length === 0) return [];

  const saleIds = sales.map((s) => s.id);

  const { data: itemsData, error } = await supabase
    .from("sale_items")
    .select("medicine_id, quantity, unit_price")
    .in("sale_id", saleIds);

  if (error || !itemsData) return [];

  const items = itemsData as unknown as SaleItemRow[];

  // Get medicine names
  const medicineIds = [...new Set(items.map((i) => i.medicine_id))];
  const { data: medsData } = await supabase
    .from("medicines")
    .select("id, name, category")
    .in("id", medicineIds);

  const meds = (medsData ?? []) as unknown as {
    id: string;
    name: string;
    category: string;
  }[];
  const medMap = new Map(meds.map((m) => [m.id, m]));

  // Aggregate
  const map = new Map<
    string,
    {
      medicine_id: string;
      name: string;
      category: string;
      totalQty: number;
      totalRevenue: number;
    }
  >();

  for (const item of items) {
    const med = medMap.get(item.medicine_id);
    const existing = map.get(item.medicine_id) || {
      medicine_id: item.medicine_id,
      name: med?.name ?? "Unknown",
      category: med?.category ?? "",
      totalQty: 0,
      totalRevenue: 0,
    };
    existing.totalQty += item.quantity;
    existing.totalRevenue += item.quantity * item.unit_price;
    map.set(item.medicine_id, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

export async function saveReport(data: {
  report_type: string;
  title: string;
  period: string;
  summary: Record<string, unknown>;
  reportData: unknown[];
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("saved_reports").insert({
    report_type: data.report_type,
    title: data.title,
    period: data.period,
    summary: data.summary,
    data: data.reportData,
    generated_by: user.id,
    branch_id: user.branch_id,
  });

  if (error) return { error: error.message };\n\n  // fire-and-forget email\n  sendReportEmail({\n    title: data.title,\n    period: data.period,\n    reportType: data.report_type,\n    summary: data.summary,\n    generatedBy: user.full_name ?? user.email ?? "Staff",\n  }).catch(() => {});\n\n  return { success: true };\n}

export async function getSavedReports() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase
    .from("saved_reports")
    .select("id, report_type, title, period, summary, generated_by, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (user.role !== "admin") {
    query = query.eq("branch_id", user.branch_id!);
  }

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function getBranchComparisonReport(year: number, month: number) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return [];

  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59`;

  const { data: branchesData } = await supabase
    .from("branches")
    .select("id, name");
  const branches = (branchesData ?? []) as unknown as {
    id: string;
    name: string;
  }[];
  if (branches.length === 0) return [];

  const { data: salesData } = await supabase
    .from("sales")
    .select("branch_id, total_amount, is_voided")
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .eq("is_voided", false);

  const sales = (salesData ?? []) as unknown as {
    branch_id: string;
    total_amount: number;
  }[];

  return branches.map((branch) => {
    const branchSales = sales.filter((s) => s.branch_id === branch.id);
    return {
      id: branch.id,
      name: branch.name,
      revenue: branchSales.reduce((sum, s) => sum + s.total_amount, 0),
      salesCount: branchSales.length,
    };
  });
}
