import { Suspense } from "react";
import {
  getDashboardStats,
  getTopMedicines,
  getRevenueChart,
  getLowStockItems,
} from "@/actions/dashboard";
import { getRecentSales } from "@/actions/sales";
import { getCurrentUser } from "@/actions/auth";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopMedicines } from "@/components/dashboard/top-medicines";
import { LowStockAlert } from "@/components/dashboard/low-stock-alert";
import { RecentSales } from "@/components/dashboard/recent-sales";
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

      {/* Stats Cards — streams first */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>

      {/* Recent Sales — streams independently */}
      <Suspense fallback={<SalesSkeleton />}>
        <RecentSalesSection />
      </Suspense>

      {/* Charts + Lists — streams independently */}
      <Suspense fallback={<ChartsSkeleton />}>
        <ChartsSection />
      </Suspense>

      {/* Low Stock — streams independently */}
      <Suspense fallback={<LowStockSkeleton />}>
        <LowStockSection />
      </Suspense>
    </div>
  );
}
