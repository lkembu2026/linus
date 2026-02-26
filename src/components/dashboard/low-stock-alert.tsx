import { AlertTriangle } from "lucide-react";

interface LowStockAlertProps {
  items: any[];
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
          {items.map((item: any, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-yellow-400/20"
            >
              <div>
                <p className="text-sm font-medium text-white">
                  {item.medicine?.name ?? "Unknown"}
                </p>
                {item.branch && (
                  <p className="text-xs text-muted-foreground">
                    {item.branch.name}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span
                  className={`text-sm font-bold ${
                    item.quantity === 0 ? "text-destructive" : "text-yellow-400"
                  }`}
                >
                  {item.quantity} left
                </span>
                <p className="text-xs text-muted-foreground">
                  min: {item.medicine?.low_stock_threshold ?? 10}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
