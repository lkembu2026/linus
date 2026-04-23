"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMode } from "@/contexts/mode-context";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppMode } from "@/types";
import {
  getDashboardPageData,
  getDashboardSupplementalData,
  type DashboardPageData,
  type DashboardSupplementalData,
} from "@/actions/dashboard";

// Components — static (lightweight, no heavy deps)
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TopMedicines } from "@/components/dashboard/top-medicines";
import { LowStockAlert } from "@/components/dashboard/low-stock-alert";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { MedicineInventoryCard } from "@/components/dashboard/medicine-inventory-card";
import { MedicineCategoryBreakdownCard } from "@/components/dashboard/medicine-category-breakdown";
import { StockLevelsTable } from "@/components/dashboard/stock-levels-table";

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
const dashboardSupplementalCache: Record<
  AppMode,
  { data: DashboardSupplementalData; ts: number } | undefined
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
  const { mode, setMode } = useMode();
  const [seedTimestamp] = useState(() => Date.now());

  // Sync client mode with server-resolved initialMode on first mount
  useEffect(() => {
    if (mode !== initialMode) {
      setMode(initialMode);
    }
  }, [mode, initialMode, setMode]);

  const [dataByMode, setDataByMode] = useState<
    Partial<Record<AppMode, DashboardPageData>>
  >(() =>
    initialData
      ? {
          [initialMode]: initialData,
        }
      : {},
  );
  const [supplementalByMode, setSupplementalByMode] = useState<
    Partial<Record<AppMode, DashboardSupplementalData>>
  >({});
  const [isRefreshingMode, setIsRefreshingMode] = useState(false);
  const [isLoadingSupplemental, setIsLoadingSupplemental] = useState(false);
  const requestIdRef = useRef(0);
  const supplementalRequestIdRef = useRef(0);
  const itemLabel = mode === "beauty" ? "products" : "medicines";
  const data =
    dataByMode[mode] ??
    dashboardCache[mode]?.data ??
    initialData ??
    null;
  const supplementalData =
    supplementalByMode[mode] ?? dashboardSupplementalCache[mode]?.data ?? null;

  useEffect(() => {
    const entry = dashboardCache[mode];

    // If cache is fresh, show it immediately without refetching
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      return;
    }

    const refreshIndicatorTimeout = window.setTimeout(() => {
      setIsRefreshingMode(true);
    }, 0);

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    getDashboardPageData(mode)
      .then((nextData) => {
        window.clearTimeout(refreshIndicatorTimeout);
        if (requestId !== requestIdRef.current) return;
        dashboardCache[mode] = { data: nextData, ts: Date.now() };
        setDataByMode((current) => ({
          ...current,
          [mode]: nextData,
        }));
        setIsRefreshingMode(false);
      })
      .catch((err) => {
        window.clearTimeout(refreshIndicatorTimeout);
        if (requestId !== requestIdRef.current) return;
        console.error("Dashboard fetch error:", err);
        setIsRefreshingMode(false);
      });

    return () => {
      window.clearTimeout(refreshIndicatorTimeout);
    };
  }, [mode]);

  useEffect(() => {
    if (initialData && !dashboardCache[initialMode]) {
      dashboardCache[initialMode] = { data: initialData, ts: seedTimestamp };
    }
  }, [initialData, initialMode, seedTimestamp]);

  useEffect(() => {
    if (!data) return;

    const entry = dashboardSupplementalCache[mode];
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      return;
    }

    supplementalRequestIdRef.current += 1;
    const requestId = supplementalRequestIdRef.current;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const loadSupplemental = () => {
      setIsLoadingSupplemental(true);

      getDashboardSupplementalData(mode)
        .then((nextData) => {
          if (requestId !== supplementalRequestIdRef.current) return;
          dashboardSupplementalCache[mode] = {
            data: nextData,
            ts: Date.now(),
          };
          setSupplementalByMode((current) => ({
            ...current,
            [mode]: nextData,
          }));
          setIsLoadingSupplemental(false);
        })
        .catch((err) => {
          if (requestId !== supplementalRequestIdRef.current) return;
          console.error("Dashboard supplemental fetch error:", err);
          setIsLoadingSupplemental(false);
        });
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(loadSupplemental, { timeout: 1000 });
    } else {
      timeoutId = setTimeout(loadSupplemental, 250);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (
        idleId !== null &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [data, mode]);

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
          <DailySalesChart data={data.dailySales ?? []} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RevenueChart data={data.revenueData ?? []} />
        <TopMedicines medicines={data.topMedicines} mode={mode} />
      </div>

      <div className="mt-6">
        <RecentSales sales={data.recentSales} userRole={data.role} />
      </div>

      {supplementalData ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <LowStockAlert items={supplementalData.lowStock} />
            <MedicineCategoryBreakdownCard
              data={supplementalData.categoryBreakdown}
            />
          </div>

          <div className="mt-6">
            <StockLevelsTable
              medicines={supplementalData.allMedicines}
              mode={mode}
            />
          </div>
        </>
      ) : (
        <DashboardSupplementalSkeleton loading={isLoadingSupplemental} />
      )}
    </>
  );
}

function DashboardSupplementalSkeleton({
  loading,
}: {
  loading: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {[1, 2].map((index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-card p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 rounded" />
              {loading && <Skeleton className="h-4 w-20 rounded" />}
            </div>
            <Skeleton className="h-[180px] w-full rounded-lg" />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48 rounded" />
          {loading && <Skeleton className="h-4 w-24 rounded" />}
        </div>
        <Skeleton className="h-[260px] w-full rounded-lg" />
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
