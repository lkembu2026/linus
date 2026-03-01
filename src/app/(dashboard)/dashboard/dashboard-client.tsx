"use client";

import { useEffect, useRef, useState } from "react";
import { useMode } from "@/contexts/mode-context";
import { MEDICINE_CATEGORIES, BEAUTY_CATEGORIES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppMode } from "@/types";

// Actions
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

// Components
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopMedicines } from "@/components/dashboard/top-medicines";
import { LowStockAlert } from "@/components/dashboard/low-stock-alert";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { MedicineInventoryCard } from "@/components/dashboard/medicine-inventory-card";
import { DailySalesChart } from "@/components/dashboard/daily-sales-chart";
import { MedicineCategoryBreakdownCard } from "@/components/dashboard/medicine-category-breakdown";

type DashboardData = {
  stats: any;
  topMedicines: any[];
  revenueData: any[];
  lowStock: any[];
  overview: any;
  dailySales: any[];
  categoryBreakdown: any[];
  recentSales: any[];
  role: string;
};

interface DashboardClientProps {
  initialData?: DashboardData;
  initialMode?: AppMode;
}

export function DashboardClient({
  initialData,
  initialMode = "pharmacy",
}: DashboardClientProps) {
  const { mode } = useMode();
  const cachedByModeRef = useRef<Record<AppMode, DashboardData | undefined>>({
    pharmacy: initialMode === "pharmacy" ? initialData : undefined,
    beauty: initialMode === "beauty" ? initialData : undefined,
  });
  const [data, setData] = useState<DashboardData | null>(
    cachedByModeRef.current[mode] ?? initialData ?? null,
  );
  const requestIdRef = useRef(0);
  const itemLabel = mode === "beauty" ? "products" : "medicines";

  useEffect(() => {
    // Mode-aware fetching. Note: DO NOT use startTransition around this await block
    // as React 19 drops state updates following an await in startTransition.
    const categories =
      mode === "beauty" ? [...BEAUTY_CATEGORIES] : [...MEDICINE_CATEGORIES];
    const cached = cachedByModeRef.current[mode];
    if (cached) {
      setData(cached);
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    Promise.all([
      getDashboardStats(categories),
      getTopMedicines(10, categories),
      getRevenueChart(30, categories),
      getLowStockItems(categories),
      getInventoryOverview(categories),
      getMedicineDailySales(14, categories),
      getMedicineCategoryBreakdown(categories),
      getRecentSales(10, categories),
      getCurrentUser(),
    ])
      .then(
        ([
          stats,
          topMedicines,
          revenueData,
          lowStock,
          overview,
          dailySales,
          categoryBreakdown,
          recentSales,
          user,
        ]) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          const nextData: DashboardData = {
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

          cachedByModeRef.current[mode] = nextData;
          setData(nextData);
        },
      )
      .catch((err) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        console.error("Dashboard fetch error:", err);
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Skeleton className="h-[300px] w-full rounded-xl bg-card" />
        <Skeleton className="lg:col-span-2 h-[300px] w-full rounded-xl bg-card" />
      </div>
    </div>
  );
}
