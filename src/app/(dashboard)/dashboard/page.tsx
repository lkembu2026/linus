import { Suspense } from "react";
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
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopMedicines } from "@/components/dashboard/top-medicines";
import { LowStockAlert } from "@/components/dashboard/low-stock-alert";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { MedicineInventoryCard } from "@/components/dashboard/medicine-inventory-card";
import { DailySalesChart } from "@/components/dashboard/daily-sales-chart";
import { MedicineCategoryBreakdownCard } from "@/components/dashboard/medicine-category-breakdown";
import { Skeleton } from "@/components/ui/skeleton";

// Individual async components for streaming
async function StatsSection() {
  const stats = await getDashboardStats();
  return <StatsCards stats={stats} />;
}

async function RecentSalesSection() {
  const [sales, user] = await Promise.all([getRecentSales(), getCurrentUser()]);
  return <RecentSales sales={sales} userRole={user?.role ?? "cashier"} />;
}

async function ChartsSection() {
  const [revenueData, topMedicines] = await Promise.all([
    getRevenueChart(),
    getTopMedicines(),
  ]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <RevenueChart data={revenueData} />
      <TopMedicines medicines={topMedicines} />
    </div>
  );
}

async function InventorySection() {
  const [overview, dailySales, categoryBreakdown] = await Promise.all([
    getInventoryOverview(),
    getMedicineDailySales(14),
    getMedicineCategoryBreakdown(),
  ]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MedicineInventoryCard data={overview} />
        <div className="lg:col-span-2">
          <DailySalesChart data={dailySales} />
        </div>
      </div>
      <MedicineCategoryBreakdownCard data={categoryBreakdown} />
    </div>
  );
}

async function LowStockSection() {
  const items = await getLowStockItems();
  return <LowStockAlert items={items} />;
}

// Skeleton fallbacks
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <Skeleton className="h-4 w-20 bg-muted/20" />
          <Skeleton className="h-7 w-16 bg-muted/30" />
        </div>
      ))}
    </div>
  );
}

function SalesSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <Skeleton className="h-5 w-28 bg-muted/30" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-24 bg-muted/20" />
          <Skeleton className="h-4 w-32 bg-muted/20" />
          <Skeleton className="h-4 w-16 bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-5 w-32 mb-4 bg-muted/30" />
          <Skeleton className="h-48 w-full bg-muted/10 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-36 bg-muted/30" />
          <Skeleton className="h-10 w-24 bg-muted/20" />
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map((i) => <Skeleton key={i} className="h-16 rounded-lg bg-muted/10" />)}
          </div>
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-5 w-40 mb-4 bg-muted/30" />
          <Skeleton className="h-[220px] w-full bg-muted/10 rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-48 mb-4 bg-muted/30" />
        <div className="space-y-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-8 w-full bg-muted/10 rounded" />)}
        </div>
      </div>
    </div>
  );
}

function LowStockSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <Skeleton className="h-5 w-36 mb-4 bg-muted/30" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-muted/10 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
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
      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>

      {/* Inventory: medicines added, daily units sold, category breakdown */}
      <Suspense fallback={<InventorySkeleton />}>
        <InventorySection />
      </Suspense>

      {/* Recent Sales */}
      <Suspense fallback={<SalesSkeleton />}>
        <RecentSalesSection />
      </Suspense>

      {/* Revenue + Top Medicines */}
      <Suspense fallback={<ChartsSkeleton />}>
        <ChartsSection />
      </Suspense>

      {/* Low Stock */}
      <Suspense fallback={<LowStockSkeleton />}>
        <LowStockSection />
      </Suspense>
    </div>
  );
}
