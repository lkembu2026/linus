import { Skeleton } from "@/components/ui/skeleton";

export default function SalesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 bg-muted/30" />
          <Skeleton className="h-4 w-24 mt-2 bg-muted/20" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full bg-muted/20" />
      </div>

      {/* POS grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search card */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-5 w-32 mb-4 bg-muted/30" />
          <Skeleton className="h-10 w-full bg-muted/10 rounded-lg" />
          <Skeleton className="h-10 w-full mt-3 bg-muted/10 rounded-lg" />
        </div>

        {/* Cart card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-20 bg-muted/30" />
          <Skeleton className="h-16 w-full bg-muted/10 rounded" />
          <Skeleton className="h-16 w-full bg-muted/10 rounded" />
          <div className="pt-4 border-t border-border">
            <Skeleton className="h-10 w-full bg-primary/20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
