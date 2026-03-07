"use client";

import { useEffect, useRef, useState } from "react";
import { useMode } from "@/contexts/mode-context";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppMode } from "@/types";
import {
  getDashboardPageData,
  type DashboardPageData,
} from "@/actions/dashboard";

// Components
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopMedicines } from "@/components/dashboard/top-medicines";
import { LowStockAlert } from "@/components/dashboard/low-stock-alert";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { MedicineInventoryCard } from "@/components/dashboard/medicine-inventory-card";
import { DailySalesChart } from "@/components/dashboard/daily-sales-chart";
import { MedicineCategoryBreakdownCard } from "@/components/dashboard/medicine-category-breakdown";

interface DashboardClientProps {
  initialData?: DashboardPageData;
  initialMode?: AppMode;
}

export function DashboardClient({
  initialData,
  initialMode = "pharmacy",
}: DashboardClientProps) {
  const { mode } = useMode();
  const initialCachedData = initialData ?? null;
  const cachedByModeRef = useRef<
    Record<AppMode, DashboardPageData | undefined>
  >({
    pharmacy: initialMode === "pharmacy" ? initialData : undefined,
    beauty: initialMode === "beauty" ? initialData : undefined,
  });
  const [data, setData] = useState<DashboardPageData | null>(initialCachedData);
  const [isRefreshingMode, setIsRefreshingMode] = useState(false);
  const requestIdRef = useRef(0);
  const itemLabel = mode === "beauty" ? "products" : "medicines";

  useEffect(() => {
    const cached = cachedByModeRef.current[mode];
    const oppositeMode: AppMode = mode === "pharmacy" ? "beauty" : "pharmacy";
    if (cached) {
      setData(cached);
      setIsRefreshingMode(true);

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      getDashboardPageData(mode)
        .then((nextData) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          cachedByModeRef.current[mode] = nextData;
          setData(nextData);
          setIsRefreshingMode(false);
        })
        .catch((err) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          console.error("Dashboard refresh error:", err);
          setIsRefreshingMode(false);
        });

      if (!cachedByModeRef.current[oppositeMode]) {
        getDashboardPageData(oppositeMode)
          .then((prefetched) => {
            cachedByModeRef.current[oppositeMode] = prefetched;
          })
          .catch(() => {
            // ignore prefetch failures; active mode data is already rendered
          });
      }
      return;
    }

    setIsRefreshingMode(true);

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    getDashboardPageData(mode)
      .then((nextData) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        cachedByModeRef.current[mode] = nextData;
        setData(nextData);
        setIsRefreshingMode(false);
        if (!cachedByModeRef.current[oppositeMode]) {
          getDashboardPageData(oppositeMode)
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
