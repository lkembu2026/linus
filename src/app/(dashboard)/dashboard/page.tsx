import { cookies } from "next/headers";
import { DashboardClient } from "./dashboard-client";
import { MODE_STORAGE_KEY, getCategoriesForMode, normalizeMode } from "@/lib/mode";
import {
  getDashboardStats,
  getTopMedicines,
  getRevenueChart,
  getLowStockItems,
  getInventoryOverview,
  getMedicineDailySales,
  getMedicineCategoryBreakdown,
} from "@/actions/dashboard";
import { getRecentSales } from "@/actions/sales";
import { getCurrentUser } from "@/actions/auth";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const mode = normalizeMode(cookieStore.get(MODE_STORAGE_KEY)?.value);
  const categories = getCategoriesForMode(mode);

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

  const initialData = {
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

  return (
    <div className="space-y-6">
      <DashboardClient initialData={initialData} initialMode={mode} />
    </div>
  );
}
