/**
 * Vercel Cron Job — Daily Report
 * Schedule: 20 19 * * *  (UTC)  = 10:20 PM EAT (UTC+3)
 *
 * Compiles today's sales across all branches and emails the admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDailySummaryEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function todayEAT(): string {
  // EAT = UTC + 3 hours
  const nowEAT = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return nowEAT.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET(req: NextRequest) {
  // ── Security: verify Vercel cron secret ──────────────────────────────────
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const date = todayEAT();
  const startOfDay = `${date}T00:00:00+03:00`;
  const endOfDay = `${date}T23:59:59+03:00`;

  try {
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

    // ── 5. Send email ──────────────────────────────────────────────────────
    await sendDailySummaryEmail({
      date,
      totalSales: activeSales.length,
      totalRevenue,
      lowStockCount: lowStockCount ?? 0,
      transfersPending: transfersPending ?? 0,
      topItems,
    });

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
