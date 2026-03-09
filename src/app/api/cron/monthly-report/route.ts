/**
 * Vercel Cron Job — Monthly Report
 * Schedule: 0 5 1 * *  (UTC)  = 8:00 AM on the 1st of each month EAT (UTC+3)
 *
 * Generates the PREVIOUS month's full report and emails the admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMonthlySummaryEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function previousMonthRange(): {
  year: number;
  month: number; // 1-based
  monthLabel: string;
  startTs: string;
  endTs: string;
} {
  const nowEAT = new Date(Date.now() + 3 * 60 * 60 * 1000);
  // "day 0" of current month = last day of previous month
  const lastDayPrev = new Date(
    Date.UTC(nowEAT.getUTCFullYear(), nowEAT.getUTCMonth(), 0),
  );
  const year = lastDayPrev.getUTCFullYear();
  const month = lastDayPrev.getUTCMonth() + 1; // 1-based
  const monthLabel = lastDayPrev.toLocaleString("en-KE", {
    month: "long",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  });
  const mm = String(month).padStart(2, "0");
  const lastDay = lastDayPrev.getUTCDate();
  const dd = String(lastDay).padStart(2, "0");

  return {
    year,
    month,
    monthLabel,
    startTs: `${year}-${mm}-01T00:00:00+03:00`,
    endTs: `${year}-${mm}-${dd}T23:59:59+03:00`,
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
  const { year, month, monthLabel, startTs, endTs } = previousMonthRange();

  try {
    const { data: existingReport } = await supabase
      .from("saved_reports")
      .select("id")
      .eq("report_type", "monthly_auto_email")
      .eq("period", monthLabel)
      .limit(1)
      .maybeSingle();

    if (existingReport) {
      return NextResponse.json({ ok: true, skipped: true, monthLabel });
    }

    // ── 1. Sales for the month ─────────────────────────────────────────────
    const { data: salesData } = await supabase
      .from("sales")
      .select(
        "id, total_amount, payment_method, is_voided, branch_id, created_at",
      )
      .gte("created_at", startTs)
      .lte("created_at", endTs);

    const sales = salesData ?? [];
    const activeSales = sales.filter((s) => !s.is_voided);
    const voidedSales = sales.filter((s) => s.is_voided);
    const totalRevenue = activeSales.reduce(
      (sum, s) => sum + (s.total_amount as number),
      0,
    );

    // Days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    const avgDailyRevenue = daysInMonth > 0 ? totalRevenue / daysInMonth : 0;

    // Payment breakdown
    const paymentBreakdown: Record<string, number> = {};
    for (const s of activeSales) {
      const pm = (s.payment_method as string) ?? "unknown";
      paymentBreakdown[pm] =
        (paymentBreakdown[pm] ?? 0) + (s.total_amount as number);
    }

    // Best day
    const dailyMap = new Map<string, number>();
    for (const s of activeSales) {
      const day = (s.created_at as string).slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + (s.total_amount as number));
    }
    const bestDay = Array.from(dailyMap.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0] ?? [`${year}-${String(month).padStart(2, "0")}-01`, 0];

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
    await sendMonthlySummaryEmail({
      monthLabel,
      totalSales: activeSales.length,
      totalRevenue,
      totalVoided: voidedSales.length,
      avgDailyRevenue,
      bestDay: { date: bestDay[0], revenue: bestDay[1] },
      paymentBreakdown,
      topItems,
      branchBreakdown,
    });

    const { error: saveError } = await supabase.from("saved_reports").insert({
      report_type: "monthly_auto_email",
      title: "Automated Monthly Summary",
      period: monthLabel,
      summary: {
        totalSales: activeSales.length,
        totalRevenue,
        totalVoided: voidedSales.length,
        avgDailyRevenue,
        bestDay: { date: bestDay[0], revenue: bestDay[1] },
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

    console.log(`[Cron] Monthly report sent for ${monthLabel}`);
    return NextResponse.json({ ok: true, monthLabel, totalRevenue });
  } catch (err) {
    console.error("[Cron] Monthly report error:", err);
    return NextResponse.json(
      { error: "Failed to generate monthly report" },
      { status: 500 },
    );
  }
}
