"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMode } from "@/contexts/mode-context";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppMode } from "@/types";
import {
  getDashboardPageData,
  type DashboardPageData,
} from "@/actions/dashboard";

// Components — static (lightweight, no heavy deps)
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TopMedicines } from "@/components/dashboard/top-medicines";
import { LowStockAlert } from "@/components/dashboard/low-stock-alert";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { MedicineInventoryCard } from "@/components/dashboard/medicine-inventory-card";
import { MedicineCategoryBreakdownCard } from "@/components/dashboard/medicine-category-breakdown";

// Components — lazy (recharts is ~300KB)
const RevenueChart = dynamic(
  () =>
    import("@/components/dashboard/revenue-chart").then((m) => m.RevenueChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] w-full rounded-lg" />,
  },
);
const DailySalesChart = dynamic(
  () =>
    import("@/components/dashboard/daily-sales-chart").then(
      (m) => m.DailySalesChart,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] w-full rounded-lg" />,
  },
);

// Module-level cache — survives component remounts during navigation
const dashboardCache: Record<
  AppMode,
  { data: DashboardPageData; ts: number } | undefined
> = {
  pharmacy: undefined,
  beauty: undefined,
};
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface DashboardClientProps {
  initialData?: DashboardPageData;
  initialMode?: AppMode;
}

export function DashboardClient({
  initialData,
  initialMode = "pharmacy",
}: DashboardClientProps) {
  const { mode } = useMode();

  // Seed module cache from server-prefetched data (only once)
  if (initialData && !dashboardCache[initialMode]) {
    dashboardCache[initialMode] = { data: initialData, ts: Date.now() };
  }

  const cached = dashboardCache[mode];
  const isFresh = cached && Date.now() - cached.ts < CACHE_TTL;
  const [data, setData] = useState<DashboardPageData | null>(
    cached?.data ?? initialData ?? null,
  );
  const [isRefreshingMode, setIsRefreshingMode] = useState(false);
  const requestIdRef = useRef(0);
  const itemLabel = mode === "beauty" ? "products" : "medicines";

  useEffect(() => {
    const entry = dashboardCache[mode];
    const oppositeMode: AppMode = mode === "pharmacy" ? "beauty" : "pharmacy";

    // If cache is fresh, show it immediately without refetching
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      setData(entry.data);
      return;
    }

    // If stale cache exists, show it and refresh in background
    if (entry) {
      setData(entry.data);
      setIsRefreshingMode(true);
    } else {
      setIsRefreshingMode(true);
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    getDashboardPageData(mode)
      .then((nextData) => {
        if (requestId !== requestIdRef.current) return;
        dashboardCache[mode] = { data: nextData, ts: Date.now() };
        setData(nextData);
        setIsRefreshingMode(false);

        // Prefetch opposite mode
        if (!dashboardCache[oppositeMode]) {
          getDashboardPageData(oppositeMode)
            .then((prefetched) => {
              dashboardCache[oppositeMode] = {
                data: prefetched,
                ts: Date.now(),
              };
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        console.error("Dashboard fetch error:", err);
        setIsRefreshingMode(false);
      });
  }, [mode]);

  if (!data) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <div>
        <h1 className="text-xl md:text-2xl font-bold font-[family-name:var(--font-sans)] text-white">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your {mode === "beauty" ? "beauty" : "pharmacy"}{" "}
          operations
        </p>
        <p className="text-xs text-primary mt-1 uppercase tracking-wide">
          {mode === "beauty" ? "Beauty Mode" : "Pharmacy Mode"} · Showing{" "}
          {itemLabel}
        </p>
        {isRefreshingMode && (
          <p className="text-xs text-muted-foreground mt-1">
            Refreshing data...
          </p>
        )}
      </div>

      <StatsCards stats={data.stats} mode={mode} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <MedicineInventoryCard data={data.overview} mode={mode} />
        <div className="lg:col-span-2">
          <DailySalesChart data={data.dailySales} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RevenueChart data={data.revenueData} />
        <TopMedicines medicines={data.topMedicines} mode={mode} />
      </div>

      <div className="mt-6">
        <RecentSales sales={data.recentSales} userRole={data.role} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <LowStockAlert items={data.lowStock} />
        <MedicineCategoryBreakdownCard data={data.categoryBreakdown} />
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-7 w-40 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md mt-2" />
        <Skeleton className="h-3 w-48 rounded-md mt-2" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Inventory + Daily Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 space-y-4">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      </div>

      {/* Revenue + Top medicines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 space-y-4"
          >
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
