import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold font-[family-name:var(--font-sans)] text-white">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your pharmacy operations
        </p>
      </div>

      <DashboardClient />
    </div>
  );
}
