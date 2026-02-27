import { Skeleton } from "@/components/ui/skeleton";

export default function BranchesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-24 bg-muted/30" />
          <Skeleton className="h-4 w-44 mt-2 bg-muted/20" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg bg-muted/20" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-6 space-y-3"
          >
            <Skeleton className="h-5 w-32 bg-muted/30" />
            <Skeleton className="h-4 w-48 bg-muted/15" />
            <Skeleton className="h-4 w-24 bg-muted/15" />
          </div>
        ))}
      </div>
    </div>
  );
}
