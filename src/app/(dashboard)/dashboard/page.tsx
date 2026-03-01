import { cookies } from "next/headers";
import { DashboardClient } from "./dashboard-client";
import {
  MODE_STORAGE_KEY,
  getCategoriesForMode,
  normalizeMode,
} from "@/lib/mode";
import {
  getDashboardStats,
  getTopMedicines,
  getRevenueChart,
  getLowStockItems,
  getInventoryOverview,
  getMedicineDailySales,
  getMedicineCategoryBreakdown,
} from "@/actions/dashboard";
import { getMedicines } from "@/actions/inventory";
import { getRecentSales } from "@/actions/sales";
import { getCurrentUser } from "@/actions/auth";
import { MEDICINE_CATEGORIES } from "@/lib/constants";

async function fetchDashboardData(categories?: string[]) {
  const [
    stats,
    topMedicines,
    revenueData,
    lowStock,
    overview,
    dailySales,
    categoryBreakdown,
    recentSales,
    user,
  ] = await Promise.all([
    getDashboardStats(categories),
    getTopMedicines(10, categories),
    getRevenueChart(30, categories),
    getLowStockItems(categories),
    getInventoryOverview(categories),
    getMedicineDailySales(14, categories),
    getMedicineCategoryBreakdown(categories),
    getRecentSales(10, categories),
    getCurrentUser(),
  ]);

  return {
    stats,
    topMedicines,
    revenueData,
    lowStock,
    overview,
    dailySales,
    categoryBreakdown,
    recentSales,
    role: user?.role ?? "cashier",
  };
}

async function getLegacyBeautyCategories(): Promise<string[]> {
  const all = await getMedicines();
  const medSet = new Set<string>(MEDICINE_CATEGORIES as readonly string[]);
  return [
    ...new Set(all.map((m) => m.category).filter((c) => !!c && !medSet.has(c))),
  ];
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const mode = normalizeMode(cookieStore.get(MODE_STORAGE_KEY)?.value);
  const categories = getCategoriesForMode(mode);

  let initialData = await fetchDashboardData(categories);

  if (mode === "pharmacy" && (initialData.stats?.totalMedicines ?? 0) === 0) {
    initialData = await fetchDashboardData(undefined);
  }

  if (mode === "beauty" && (initialData.stats?.totalMedicines ?? 0) === 0) {
    const fallbackCategories = await getLegacyBeautyCategories();
    if (fallbackCategories.length > 0) {
      initialData = await fetchDashboardData(fallbackCategories);
    }
  }

  return (
    <div className="space-y-6">
      <DashboardClient initialData={initialData} initialMode={mode} />
    </div>
  );
}
