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
import { getMedicines } from "@/actions/inventory";
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

const modeCategoriesMap = {
  pharmacy: [...MEDICINE_CATEGORIES],
  beauty: [...BEAUTY_CATEGORIES],
} as const;

interface DashboardClientProps {
  initialData?: DashboardData;
  initialMode?: AppMode;
}

async function getLegacyBeautyCategories(): Promise<string[]> {
  const all = await getMedicines();
  const medSet = new Set<string>(MEDICINE_CATEGORIES as readonly string[]);
  return [
    ...new Set(all.map((m) => m.category).filter((c) => !!c && !medSet.has(c))),
  ];
}

async function fetchDashboardData(
  categories?: string[],
): Promise<DashboardData> {
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

async function loadModeData(targetMode: AppMode): Promise<DashboardData> {
  let nextData = await fetchDashboardData([...modeCategoriesMap[targetMode]]);

  if (targetMode === "beauty" && (nextData.stats?.totalMedicines ?? 0) === 0) {
    const fallbackCategories = await getLegacyBeautyCategories();
    if (fallbackCategories.length > 0) {
      nextData = await fetchDashboardData(fallbackCategories);
    }
  }

  return nextData;
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
    // Mode-aware fetching. Keep rendered data strictly aligned to selected mode.
    // If the selected mode has no cache yet, clear current data so wrong-mode
    // values are never shown while loading.
    const cached = cachedByModeRef.current[mode];
    const oppositeMode: AppMode = mode === "pharmacy" ? "beauty" : "pharmacy";
    if (cached) {
      setData(cached);
      if (!cachedByModeRef.current[oppositeMode]) {
        loadModeData(oppositeMode)
          .then((prefetched) => {
            cachedByModeRef.current[oppositeMode] = prefetched;
          })
          .catch(() => {
            // ignore prefetch failures; active mode data is already rendered
          });
      }
      return;
    } else {
      setData(null);
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    loadModeData(mode)
      .then(async (nextData) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        cachedByModeRef.current[mode] = nextData;
        setData(nextData);
        if (!cachedByModeRef.current[oppositeMode]) {
          loadModeData(oppositeMode)
            .then((prefetched) => {
              cachedByModeRef.current[oppositeMode] = prefetched;
            })
            .catch(() => {
              // ignore prefetch failures; active mode data is already rendered
            });
        }
      })
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
