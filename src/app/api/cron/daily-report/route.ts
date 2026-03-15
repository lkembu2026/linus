/**
 * Vercel Cron Job — Daily Report
 * Schedule: 0 * * * *  (UTC)  = every hour
 * The cron reads the admin-configured hour from the DB and only sends
 * when the current EAT hour matches. Default: 23 (11 PM EAT).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDailySummaryEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function todayEAT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function currentEATHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
}

export async function GET(req: NextRequest) {
  // ── Security: verify Vercel cron secret ──────────────────────────────────
  const auth = req.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // ── Check configured hour ────────────────────────────────────────────────
  const { data: settings } = await supabase
    .from("report_settings")
    .select("daily_report_hour, daily_enabled")
    .eq("key", "default")
    .maybeSingle();

  const configuredHour = settings?.daily_report_hour ?? 23;
  const dailyEnabled = settings?.daily_enabled ?? true;
  const nowHour = currentEATHour();

  if (!dailyEnabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "daily_disabled",
    });
  }

  if (nowHour !== configuredHour) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not_scheduled_hour",
      nowHour,
      configuredHour,
    });
  }

  const date = todayEAT();
  const startOfDay = `${date}T00:00:00+03:00`;
  const endOfDay = `${date}T23:59:59+03:00`;

  try {
    const { data: existingReport } = await supabase
      .from("saved_reports")
      .select("id")
      .eq("report_type", "daily_auto_email")
      .eq("period", date)
      .limit(1)
      .maybeSingle();

    if (existingReport) {
      return NextResponse.json({ ok: true, skipped: true, date });
    }

    // ── 1. Fetch today's sales ─────────────────────────────────────────────
    const { data: salesData } = await supabase
      .from("sales")
      .select("id, total_amount, payment_method, is_voided")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    const sales = salesData ?? [];
    const activeSales = sales.filter((s) => !s.is_voided);
    const totalRevenue = activeSales.reduce(
      (sum, s) => sum + (s.total_amount as number),
      0,
    );

    // ── 2. Top selling items ───────────────────────────────────────────────
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
        .slice(0, 5);
    }

    // ── 3. Low stock count ─────────────────────────────────────────────────
    const { count: lowStockCount } = await supabase
      .from("medicines")
      .select("id", { count: "exact", head: true })
      .lte("quantity_in_stock", 10)
      .gt("quantity_in_stock", 0);

    // ── 4. Pending transfers ───────────────────────────────────────────────
    const { count: transfersPending } = await supabase
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const summary = {
      totalSales: activeSales.length,
      totalRevenue,
      lowStockCount: lowStockCount ?? 0,
      transfersPending: transfersPending ?? 0,
    };

    // ── 5. Send email ──────────────────────────────────────────────────────
    await sendDailySummaryEmail({
      date,
      totalSales: summary.totalSales,
      totalRevenue: summary.totalRevenue,
      lowStockCount: summary.lowStockCount,
      transfersPending: summary.transfersPending,
      topItems,
    });

    const { error: saveError } = await supabase.from("saved_reports").insert({
      report_type: "daily_auto_email",
      title: "Automated Daily Summary",
      period: date,
      summary,
      data: topItems,
      generated_by: null,
      branch_id: null,
    });

    if (saveError) {
      throw saveError;
    }

    console.log(`[Cron] Daily report sent for ${date}`);
    return NextResponse.json({ ok: true, date, totalRevenue });
  } catch (err) {
    console.error("[Cron] Daily report error:", err);
    return NextResponse.json(
      { error: "Failed to generate daily report" },
      { status: 500 },
    );
  }
}
