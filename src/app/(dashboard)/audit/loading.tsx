import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-24 bg-muted/30" />
        <Skeleton className="h-4 w-48 mt-2 bg-muted/20" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 bg-muted/10 rounded-lg" />
        <Skeleton className="h-10 w-32 bg-muted/10 rounded-lg" />
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-36 bg-muted/20" />
              <Skeleton className="h-4 w-24 bg-muted/15" />
              <Skeleton className="h-4 w-32 bg-muted/15" />
              <Skeleton className="h-4 w-20 bg-muted/15" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
