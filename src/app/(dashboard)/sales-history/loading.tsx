import { Skeleton } from "@/components/ui/skeleton";

export default function SalesHistoryLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 bg-muted/30" />
          <Skeleton className="h-4 w-52 mt-2 bg-muted/20" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full bg-muted/20" />
      </div>
      <Skeleton className="h-10 w-full bg-muted/10 rounded-lg" />
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24 bg-muted/20" />
              <Skeleton className="h-4 w-40 bg-muted/15" />
              <Skeleton className="h-4 w-16 bg-muted/15" />
              <Skeleton className="h-4 w-20 bg-muted/15" />
              <Skeleton className="h-4 w-24 bg-muted/15" />
              <Skeleton className="h-6 w-16 rounded-full bg-muted/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
