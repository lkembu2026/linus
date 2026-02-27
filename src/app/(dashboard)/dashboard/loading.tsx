import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-7 w-32 bg-muted/30" />
        <Skeleton className="h-4 w-56 mt-2 bg-muted/20" />
      </div>

      {/* Stats cards skeleton */}
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

      {/* Recent sales skeleton */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-28 bg-muted/30" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24 bg-muted/20" />
            <Skeleton className="h-4 w-32 bg-muted/20" />
            <Skeleton className="h-4 w-16 bg-muted/20" />
            <Skeleton className="h-4 w-20 bg-muted/20" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-5 w-32 mb-4 bg-muted/30" />
          <Skeleton className="h-48 w-full bg-muted/10 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-5 w-32 mb-4 bg-muted/30" />
          <Skeleton className="h-48 w-full bg-muted/10 rounded-lg" />
        </div>
      </div>

      {/* Low stock skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-36 mb-4 bg-muted/30" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-muted/10 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
