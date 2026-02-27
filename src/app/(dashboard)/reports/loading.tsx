import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-24 bg-muted/30" />
        <Skeleton className="h-4 w-52 mt-2 bg-muted/20" />
      </div>

      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-80 bg-muted/10 rounded-lg" />

      {/* Content skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-40 mb-4 bg-muted/30" />
        <Skeleton className="h-64 w-full bg-muted/10 rounded-lg" />
      </div>
    </div>
  );
}
