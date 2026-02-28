"use client";

import { CheckCircle2, AlertTriangle, XCircle, PlusCircle } from "lucide-react";
import type { InventoryOverview } from "@/types";
import type { AppMode } from "@/types";

interface MedicineInventoryCardProps {
  data: InventoryOverview;
  mode?: AppMode;
}

export function MedicineInventoryCard({
  data,
  mode = "pharmacy",
}: MedicineInventoryCardProps) {
  const { total, in_stock, low_stock, out_of_stock, recently_added } = data;
  const itemLabel = mode === "beauty" ? "products" : "medicines";
  const titleLabel = mode === "beauty" ? "Product" : "Medicine";

  const statusItems = [
    {
      label: "In Stock",
      value: in_stock,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Low Stock",
      value: low_stock,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Out of Stock",
      value: out_of_stock,
      icon: XCircle,
      color: "text-red-400",
      bg: "bg-red-400/10",
    },
  ];

  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold font-[family-name:var(--font-sans)] text-white">
          {titleLabel} <span className="text-primary">Inventory</span>
        </h3>
        <p className="text-3xl font-bold text-primary mt-1">
          {total.toLocaleString()}
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {itemLabel} total
          </span>
        </p>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {statusItems.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className={`rounded-lg ${bg} border border-border px-3 py-2.5 flex flex-col items-center gap-1`}
          >
            <Icon className={`h-4 w-4 ${color}`} />
            <span className={`text-lg font-bold ${color}`}>{value}</span>
            <span className="text-[10px] text-muted-foreground text-center leading-tight">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Additions timeline */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <PlusCircle className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {titleLabel}s Added (Last 30 Days)
          </span>
        </div>
        {recently_added.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No {itemLabel} added in the last 30 days
          </p>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {[...recently_added].reverse().map(({ date, count }) => {
              const d = new Date(date);
              const label = d.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              return (
                <div
                  key={date}
                  className="flex items-center justify-between rounded-md bg-background/50 border border-border px-3 py-1.5"
                >
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs font-semibold text-primary">
                    +{count} added
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
