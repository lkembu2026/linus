const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    const rawValue = trimmed.slice(idx + 1).trim();
    const value = rawValue.replace(/^['\"]|['\"]$/g, "");
    env[key] = value;
  }
  return env;
}

async function main() {
  const envPath = path.join(process.cwd(), ".env.local");
  const env = loadEnv(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { data: todaySales, error: salesError } = await supabase
    .from("sales")
    .select(
      "id, total_amount, payment_method, is_voided, created_at, branch_id",
    )
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  if (salesError) {
    console.error("sales query error:", salesError.message);
    process.exit(1);
  }

  const nonVoided = (todaySales || []).filter((row) => !row.is_voided);
  console.log("today_sales_count:", todaySales?.length || 0);
  console.log("today_non_voided_count:", nonVoided.length);

  if ((todaySales || []).length > 0) {
    console.log(
      "today_sales_sample:",
      JSON.stringify(todaySales.slice(0, 5), null, 2),
    );

    const ids = todaySales.map((row) => row.id);
    const { data: items, error: itemsError } = await supabase
      .from("sale_items")
      .select("sale_id, medicine_id, quantity, unit_price")
      .in("sale_id", ids);

    if (itemsError) {
      console.error("sale_items query error:", itemsError.message);
      process.exit(1);
    }

    console.log("today_sale_items_count:", items?.length || 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
