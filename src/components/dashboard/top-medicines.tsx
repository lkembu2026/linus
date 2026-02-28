import { formatCurrency } from "@/lib/utils";
import type { TopMedicine } from "@/types";
import type { AppMode } from "@/types";

interface TopMedicinesProps {
  medicines: TopMedicine[];
  mode?: AppMode;
}

export function TopMedicines({
  medicines,
  mode = "pharmacy",
}: TopMedicinesProps) {
  const itemLabel = mode === "beauty" ? "Products" : "Medicines";

  return (
    <div className="glass-card p-6">
      <h3 className="text-base font-semibold font-[family-name:var(--font-sans)] text-white mb-4">
        Top Selling <span className="text-primary">{itemLabel}</span>
      </h3>

      {medicines.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No sales data yet this month
        </p>
      ) : (
        <div className="space-y-3">
          {medicines.map((med, index) => (
            <div
              key={med.medicine_id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">
                    {med.medicine_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {med.total_quantity} units sold
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold text-primary">
                {formatCurrency(med.total_revenue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
