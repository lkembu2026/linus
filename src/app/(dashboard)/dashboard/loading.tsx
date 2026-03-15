import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
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
