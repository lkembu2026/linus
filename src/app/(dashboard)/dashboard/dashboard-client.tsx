"use client";

import { useEffect, useState } from "react";
import { useMode } from "@/contexts/mode-context";
import { MEDICINE_CATEGORIES, BEAUTY_CATEGORIES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

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

export function DashboardClient() {
  const { mode } = useMode();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Mode-aware fetching. Note: DO NOT use startTransition around this await block
    // as React 19 drops state updates following an await in startTransition.
    const categories =
      mode === "beauty" ? [...BEAUTY_CATEGORIES] : [...MEDICINE_CATEGORIES];

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
    ]).then(
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
        setData({
          stats,
          topMedicines,
          revenueData,
          lowStock,
          overview,
          dailySales,
          categoryBreakdown,
          recentSales,
          role: user?.role ?? "cashier",
        });
      }
    ).catch((err) => {
        console.error("Dashboard fetch error:", err);
    });
  }, [mode]);

  if (!data) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <StatsCards stats={data.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <MedicineInventoryCard data={data.overview} />
        <div className="lg:col-span-2">
          <DailySalesChart data={data.dailySales} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RevenueChart data={data.revenueData} />
        <TopMedicines medicines={data.topMedicines} />
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
