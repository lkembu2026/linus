/**
 * Vercel Cron Job — Weekly Report
 * Schedule: 59 20 * * 0  (UTC)  = 11:59 PM Sunday EAT (UTC+3)
 *
 * Compiles Mon–Sun sales across all branches and emails the admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklySummaryEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function currentWeekEAT(): { start: string; end: string } {
  const nowEAT = new Date(Date.now() + 3 * 60 * 60 * 1000);
  // Sunday = day 0; we want Mon–Sun
  const day = nowEAT.getUTCDay(); // 0 = Sun
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(nowEAT.getTime() - diffToMonday * 86400000);
  return {
    start: monday.toISOString().slice(0, 10),
    end: nowEAT.toISOString().slice(0, 10),
  };
}

export async function GET(req: NextRequest) {
  // ── Security ───────────────────────────────────────────────────────────
  const auth = req.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { start, end } = currentWeekEAT();
  const startTs = `${start}T00:00:00+03:00`;
  const endTs = `${end}T23:59:59+03:00`;

  try {
    const period = `${start} to ${end}`;
    const { data: existingReport } = await supabase
      .from("saved_reports")
      .select("id")
      .eq("report_type", "weekly_auto_email")
      .eq("period", period)
      .limit(1)
      .maybeSingle();

    if (existingReport) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        weekStart: start,
        weekEnd: end,
      });
    }

    // ── 1. Sales for the week ──────────────────────────────────────────────
    const { data: salesData } = await supabase
      .from("sales")
      .select("id, total_amount, payment_method, is_voided, branch_id")
      .gte("created_at", startTs)
      .lte("created_at", endTs);

    const sales = salesData ?? [];
    const activeSales = sales.filter((s) => !s.is_voided);
    const voidedSales = sales.filter((s) => s.is_voided);
    const totalRevenue = activeSales.reduce(
      (sum, s) => sum + (s.total_amount as number),
      0,
    );

    // Payment breakdown
    const paymentBreakdown: Record<string, number> = {};
    for (const s of activeSales) {
      const pm = (s.payment_method as string) ?? "unknown";
      paymentBreakdown[pm] =
        (paymentBreakdown[pm] ?? 0) + (s.total_amount as number);
    }

    // Days count (for avg)
    const dayCount = 7;
    const avgDailyRevenue = totalRevenue / dayCount;

    // ── 2. Branch breakdown ────────────────────────────────────────────────
    const { data: branchesData } = await supabase
      .from("branches")
      .select("id, name");
    const branches = branchesData ?? [];

    const branchBreakdown = branches
      .map((b) => {
        const bSales = activeSales.filter((s) => s.branch_id === b.id);
        return {
          name: b.name as string,
          revenue: bSales.reduce(
            (sum, s) => sum + (s.total_amount as number),
            0,
          ),
          salesCount: bSales.length,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // ── 3. Top selling items ───────────────────────────────────────────────
    const saleIds = activeSales.map((s) => s.id as string);
    let topItems: { name: string; quantity: number; revenue: number }[] = [];

    if (saleIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("sale_items")
        .select("medicine_id, quantity, unit_price")
        .in("sale_id", saleIds);

      const items = itemsData ?? [];
      const medicineIds = [
        ...new Set(items.map((i) => i.medicine_id as string)),
      ];

      const { data: medsData } = await supabase
        .from("medicines")
        .select("id, name")
        .in("id", medicineIds);

      const medMap = new Map(
        (medsData ?? []).map((m) => [m.id as string, m.name as string]),
      );

      const map = new Map<
        string,
        { name: string; quantity: number; revenue: number }
      >();
      for (const item of items) {
        const id = item.medicine_id as string;
        const cur = map.get(id) ?? {
          name: medMap.get(id) ?? "Unknown",
          quantity: 0,
          revenue: 0,
        };
        cur.quantity += item.quantity as number;
        cur.revenue += (item.quantity as number) * (item.unit_price as number);
        map.set(id, cur);
      }

      topItems = Array.from(map.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    }

    // ── 4. Send email ──────────────────────────────────────────────────────
    await sendWeeklySummaryEmail({
      weekStart: start,
      weekEnd: end,
      totalSales: activeSales.length,
      totalRevenue,
      totalVoided: voidedSales.length,
      avgDailyRevenue,
      paymentBreakdown,
      topItems,
      branchBreakdown,
    });

    const { error: saveError } = await supabase.from("saved_reports").insert({
      report_type: "weekly_auto_email",
      title: "Automated Weekly Summary",
      period,
      summary: {
        totalSales: activeSales.length,
        totalRevenue,
        totalVoided: voidedSales.length,
        avgDailyRevenue,
        paymentBreakdown,
      },
      data: {
        topItems,
        branchBreakdown,
      },
      generated_by: null,
      branch_id: null,
    });

    if (saveError) {
      throw saveError;
    }

    console.log(`[Cron] Weekly report sent for ${start} → ${end}`);
    return NextResponse.json({
      ok: true,
      weekStart: start,
      weekEnd: end,
      totalRevenue,
    });
  } catch (err) {
    console.error("[Cron] Weekly report error:", err);
    return NextResponse.json(
      { error: "Failed to generate weekly report" },
      { status: 500 },
    );
  }
}
