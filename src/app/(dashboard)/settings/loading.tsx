import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-24 bg-muted/30" />
        <Skeleton className="h-4 w-52 mt-2 bg-muted/20" />
      </div>
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-20 bg-muted/20" />
          <Skeleton className="h-10 w-full bg-muted/10 rounded-lg" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24 bg-muted/20" />
          <Skeleton className="h-10 w-full bg-muted/10 rounded-lg" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-28 bg-muted/20" />
          <Skeleton className="h-10 w-full bg-muted/10 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-28 bg-primary/20 rounded-lg" />
      </div>
    </div>
  );
}
