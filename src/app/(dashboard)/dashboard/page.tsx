import {
  getDashboardStats,
  getTopMedicines,
  getRevenueChart,
  getLowStockItems,
} from "@/actions/dashboard";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopMedicines } from "@/components/dashboard/top-medicines";
import { LowStockAlert } from "@/components/dashboard/low-stock-alert";

export default async function DashboardPage() {
  const [stats, topMedicines, revenueData, lowStockItems] = await Promise.all([
    getDashboardStats(),
    getTopMedicines(),
    getRevenueChart(),
    getLowStockItems(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold font-[family-name:var(--font-sans)] text-white">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your pharmacy operations
        </p>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Charts + Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={revenueData} />
        <TopMedicines medicines={topMedicines} />
      </div>

      {/* Low Stock */}
      <LowStockAlert items={lowStockItems} />
    </div>
  );
}
