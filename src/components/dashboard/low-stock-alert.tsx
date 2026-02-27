import { AlertTriangle } from "lucide-react";
import type { Medicine } from "@/types/database";

interface LowStockAlertProps {
  items: Medicine[];
}

export function LowStockAlert({ items }: LowStockAlertProps) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-yellow-400" />
        <h3 className="text-base font-semibold font-[family-name:var(--font-sans)] text-white">
          Low Stock <span className="text-yellow-400">Alerts</span>
        </h3>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          All stock levels healthy
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-yellow-400/20"
            >
              <div>
                <p className="text-sm font-medium text-white">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
              </div>
              <div className="text-right">
                <span
                  className={`text-sm font-bold ${
                    item.quantity_in_stock === 0
                      ? "text-destructive"
                      : "text-yellow-400"
                  }`}
                >
                  {item.quantity_in_stock} left
                </span>
                <p className="text-xs text-muted-foreground">
                  min: {item.reorder_level}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
