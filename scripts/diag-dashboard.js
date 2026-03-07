const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const lines = fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.trim().startsWith("#"));

  return Object.fromEntries(
    lines.map((line) => {
      const i = line.indexOf("=");
      return [
        line.slice(0, i),
        line.slice(i + 1).replace(/^['\"]|['\"]$/g, ""),
      ];
    }),
  );
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const MED = [
    "Painkillers",
    "Antibiotics",
    "Antihistamines",
    "Antacids",
    "Antifungals",
    "Cardiovascular",
    "Diabetes",
    "Respiratory",
    "Vitamins & Supplements",
    "Dermatology",
    "Gastrointestinal",
    "Eye & Ear",
    "Other",
  ];

  const { data: branches, error: bErr } = await supabase
    .from("branches")
    .select("id,name")
    .order("created_at", { ascending: true });

  if (bErr) {
    console.error("branches error", bErr.message);
    process.exit(1);
  }

  const branchId = branches?.[0]?.id;

  const { data: meds, error: mErr } = await supabase
    .from("medicines")
    .select("id,category,quantity_in_stock,reorder_level,branch_id")
    .eq("branch_id", branchId)
    .in("category", MED);

  if (mErr) {
    console.error("meds error", mErr.message);
    process.exit(1);
  }

  const medIds = (meds || []).map((m) => m.id);

  const { data: saleItems, error: siErr } = await supabase
    .from("sale_items")
    .select("sale_id,medicine_id,quantity,unit_price")
    .in("medicine_id", medIds);

  if (siErr) {
    console.error("sale_items error", siErr.message);
    process.exit(1);
  }

  const validSaleIds = [...new Set((saleItems || []).map((s) => s.sale_id))];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let salesQuery = supabase
    .from("sales")
    .select("id,total_amount,created_at,is_voided,branch_id")
    .eq("is_voided", false)
    .eq("branch_id", branchId)
    .gte("created_at", today.toISOString());

  if (validSaleIds.length === 0) {
    salesQuery = salesQuery.limit(0);
  } else {
    salesQuery = salesQuery.in("id", validSaleIds);
  }

  const { data: sales, error: sErr } = await salesQuery;

  if (sErr) {
    console.error("sales error", sErr.message);
    process.exit(1);
  }

  const revenue = (sales || []).reduce(
    (sum, row) => sum + Number(row.total_amount || 0),
    0,
  );

  console.log("branch", branches?.[0]);
  console.log("med_count", meds?.length || 0);
  console.log(
    "low_stock",
    (meds || []).filter((m) => m.quantity_in_stock <= m.reorder_level).length,
  );
  console.log(
    "in_stock",
    (meds || []).filter((m) => m.quantity_in_stock > m.reorder_level).length,
  );
  console.log(
    "out_stock",
    (meds || []).filter((m) => m.quantity_in_stock === 0).length,
  );
  console.log("valid_sale_ids", validSaleIds.length);
  console.log("today_sales_count", sales?.length || 0);
  console.log("today_revenue", revenue);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
