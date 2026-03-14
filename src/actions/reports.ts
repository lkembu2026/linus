"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/actions/auth";
import { sendDailySummaryEmail, sendReportEmail } from "@/lib/email";
import { hasPermission } from "@/lib/permissions";
import type { ReportSettings } from "@/types";

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

type ReportAutomationSettingsResult = {
  recipients: string[];
  updated_at: string | null;
  source: "database" | "environment";
};

function getFallbackReportRecipients(): string[] {
  const configured = process.env.REPORT_EMAILS ?? process.env.ADMIN_EMAIL ?? "";
  const recipients = configured
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  return recipients.length > 0
    ? recipients
    : [process.env.ADMIN_EMAIL ?? "admin@lkpharmacare.com"];
}

function getTodayEAT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseRecipients(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function getReportAutomationSettings(): Promise<ReportAutomationSettingsResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_settings")) {
    return {
      recipients: getFallbackReportRecipients(),
      updated_at: null,
      source: "environment",
    };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("report_settings")
      .select("key, recipients, updated_at")
      .eq("key", "default")
      .maybeSingle();

    if (error) {
      console.warn("getReportAutomationSettings fallback:", error.message);
      return {
        recipients: getFallbackReportRecipients(),
        updated_at: null,
        source: "environment",
      };
    }

    const settings = data as Pick<
      ReportSettings,
      "recipients" | "updated_at"
    > | null;
    const recipients = (settings?.recipients ?? []).filter(Boolean);

    return {
      recipients:
        recipients.length > 0 ? recipients : getFallbackReportRecipients(),
      updated_at: settings?.updated_at ?? null,
      source: recipients.length > 0 ? "database" : "environment",
    };
  } catch (error) {
    console.warn("getReportAutomationSettings fallback:", error);
    return {
      recipients: getFallbackReportRecipients(),
      updated_at: null,
      source: "environment",
    };
  }
}

export async function updateReportAutomationSettings(rawRecipients: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!hasPermission(user.role, "manage_settings")) {
    return { error: "Insufficient permissions" };
  }

  const recipients = parseRecipients(rawRecipients);
  const invalidRecipients = recipients.filter((email) => !isValidEmail(email));
  if (invalidRecipients.length > 0) {
    return { error: `Invalid email address: ${invalidRecipients[0]}` };
  }

  try {
    const supabase = createAdminClient();
    const updated_at = new Date().toISOString();
    const { error } = await supabase.from("report_settings").upsert(
      {
        key: "default",
        recipients,
        updated_by: user.id,
        updated_at,
      },
      { onConflict: "key" },
    );

    if (error) {
      return {
        error:
          error.code === "42P01"
            ? "Report settings table is missing. Run the latest Supabase migration first."
            : error.message,
      };
    }

    return {
      success: true,
      settings: {
        recipients,
        updated_at,
        source: recipients.length > 0 ? "database" : "environment",
      } as ReportAutomationSettingsResult,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update report settings",
    };
  }
}

export async function sendTestDailyReportNow() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!hasPermission(user.role, "manage_settings")) {
    return { error: "Insufficient permissions" };
  }
  if (!process.env.RESEND_API_KEY) {
    return { error: "RESEND_API_KEY is not configured" };
  }

  const supabase = createAdminClient();
  const date = getTodayEAT();
  const startOfDay = `${date}T00:00:00+03:00`;
  const endOfDay = `${date}T23:59:59+03:00`;

  try {
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("id, total_amount, payment_method, is_voided")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    if (salesError) {
      return { error: salesError.message };
    }

    const sales = salesData ?? [];
    const activeSales = sales.filter((sale) => !sale.is_voided);
    const totalRevenue = activeSales.reduce(
      (sum, sale) => sum + Number(sale.total_amount ?? 0),
      0,
    );

    const saleIds = activeSales.map((sale) => String(sale.id));
    let topItems: { name: string; quantity: number; revenue: number }[] = [];

    if (saleIds.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase
        .from("sale_items")
        .select("medicine_id, quantity, unit_price")
        .in("sale_id", saleIds);

      if (itemsError) {
        return { error: itemsError.message };
      }

      const items = itemsData ?? [];
      const medicineIds = [
        ...new Set(items.map((item) => String(item.medicine_id))),
      ];
      const { data: medicinesData, error: medicinesError } = await supabase
        .from("medicines")
        .select("id, name")
        .in("id", medicineIds);

      if (medicinesError) {
        return { error: medicinesError.message };
      }

      const nameMap = new Map(
        (medicinesData ?? []).map((medicine) => [
          String(medicine.id),
          String(medicine.name),
        ]),
      );

      const itemMap = new Map<
        string,
        { name: string; quantity: number; revenue: number }
      >();

      for (const item of items) {
        const medicineId = String(item.medicine_id);
        const existing = itemMap.get(medicineId) ?? {
          name: nameMap.get(medicineId) ?? "Unknown",
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += Number(item.quantity ?? 0);
        existing.revenue +=
          Number(item.quantity ?? 0) * Number(item.unit_price ?? 0);
        itemMap.set(medicineId, existing);
      }

      topItems = Array.from(itemMap.values())
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 5);
    }

    const [{ count: lowStockCount }, { count: transfersPending }] =
      await Promise.all([
        supabase
          .from("medicines")
          .select("id", { count: "exact", head: true })
          .lte("quantity_in_stock", 10)
          .gt("quantity_in_stock", 0),
        supabase
          .from("transfers")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

    const summary = {
      totalSales: activeSales.length,
      totalRevenue,
      lowStockCount: lowStockCount ?? 0,
      transfersPending: transfersPending ?? 0,
      testSend: true,
    };

    await sendDailySummaryEmail({
      date,
      totalSales: summary.totalSales,
      totalRevenue: summary.totalRevenue,
      lowStockCount: summary.lowStockCount,
      transfersPending: summary.transfersPending,
      topItems,
    });

    const period = `${date} test ${new Date().toISOString()}`;
    const { error: saveError } = await supabase.from("saved_reports").insert({
      report_type: "daily_test_email",
      title: "Manual Test Daily Summary",
      period,
      summary,
      data: topItems,
      generated_by: user.id,
      branch_id: null,
    });

    if (saveError) {
      console.error("sendTestDailyReportNow save error:", saveError);
    }

    const settings = await getReportAutomationSettings();

    return {
      success: true,
      date,
      recipients: settings.recipients,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to send test daily report",
    };
  }
}

export async function getDailySalesReport(date: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "view_reports")) {
    return { sales: [], summary: null };
  }

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
  if (!user || !hasPermission(user.role, "view_reports")) {
    return { dailyData: [], summary: null };
  }

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
  if (!user || !hasPermission(user.role, "view_reports")) return [];

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
  if (!hasPermission(user.role, "save_reports")) {
    return { error: "Insufficient permissions" };
  }

  const { error } = await supabase.from("saved_reports").insert({
    report_type: data.report_type,
    title: data.title,
    period: data.period,
    summary: data.summary,
    data: data.reportData,
    generated_by: user.id,
    branch_id: user.branch_id,
  });

  if (error) return { error: error.message };

  // fire-and-forget email
  sendReportEmail({
    title: data.title,
    period: data.period,
    reportType: data.report_type,
    summary: data.summary,
    generatedBy: user.full_name ?? user.email ?? "Staff",
  }).catch(() => {});

  return { success: true };
}

export async function getSavedReports() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "view_reports")) return [];

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
  if (!user || !hasPermission(user.role, "view_branch_comparison")) return [];

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
