import { ShoppingCart, Package } from "lucide-react";
import type { MedicineCategoryBreakdown } from "@/types";

interface MedicineCategoryBreakdownProps {
  data: MedicineCategoryBreakdown[];
}

// Colour pool for category rows
const COLOURS = [
  "bg-primary/20 text-primary border-primary/30",
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "bg-sky-500/20 text-sky-400 border-sky-500/30",
];

export function MedicineCategoryBreakdownCard({
  data,
}: MedicineCategoryBreakdownProps) {
  const maxStock = Math.max(...data.map((d) => d.remaining_stock), 1);
  const totalSold = data.reduce((s, d) => s + d.units_sold, 0);
  const totalStock = data.reduce((s, d) => s + d.remaining_stock, 0);

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold font-[family-name:var(--font-sans)] text-white">
            Stock & Sales <span className="text-primary">by Category</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.length} categories · {totalStock.toLocaleString()} units
            remaining · {totalSold.toLocaleString()} sold
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-3.5 w-3.5 text-primary" /> Remaining
          </span>
          <span className="flex items-center gap-1">
            <ShoppingCart className="h-3.5 w-3.5 text-amber-400" /> Sold
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No inventory data available yet
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((item, idx) => {
            const colour = COLOURS[idx % COLOURS.length];
            const pct = Math.round((item.remaining_stock / maxStock) * 100);
            return (
              <div key={item.category}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colour}`}
                  >
                    {item.category}
                  </span>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-white">
                        {item.remaining_stock.toLocaleString()}
                      </span>{" "}
                      left
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-amber-400">
                        {item.units_sold.toLocaleString()}
                      </span>{" "}
                      sold
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
