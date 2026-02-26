import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  Pill,
} from "lucide-react";
import type { DashboardStats } from "@/types";

interface StatsCardsProps {
  stats: DashboardStats;
}

const cards = [
  {
    key: "totalRevenueToday" as const,
    label: "Today's Revenue",
    icon: DollarSign,
    format: "currency",
    glowColor: "rgba(0, 255, 224, 0.15)",
  },
  {
    key: "totalRevenueMonth" as const,
    label: "Monthly Revenue",
    icon: TrendingUp,
    format: "currency",
    glowColor: "rgba(0, 184, 169, 0.15)",
  },
  {
    key: "salesCountToday" as const,
    label: "Sales Today",
    icon: ShoppingCart,
    format: "number",
    glowColor: "rgba(0, 139, 139, 0.15)",
  },
  {
    key: "salesCountMonth" as const,
    label: "Sales This Month",
    icon: Package,
    format: "number",
    glowColor: "rgba(34, 197, 94, 0.15)",
  },
  {
    key: "lowStockCount" as const,
    label: "Low Stock Alerts",
    icon: AlertTriangle,
    format: "number",
    glowColor: "rgba(245, 158, 11, 0.15)",
    warn: true,
  },
  {
    key: "totalMedicines" as const,
    label: "Total Medicines",
    icon: Pill,
    format: "number",
    glowColor: "rgba(59, 130, 246, 0.15)",
  },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key];
        const displayValue =
          card.format === "currency"
            ? formatCurrency(value)
            : value.toLocaleString();

        return (
          <div
            key={card.key}
            className="glass-card p-5 group"
            style={{
              boxShadow: `0 0 20px ${card.glowColor}`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: card.glowColor }}
              >
                <Icon
                  className={`h-5 w-5 ${
                    card.warn && value > 0 ? "text-yellow-400" : "text-primary"
                  }`}
                />
              </div>
            </div>
            <p
              className={`text-2xl font-bold font-[family-name:var(--font-sans)] ${
                card.warn && value > 0 ? "text-yellow-400" : "text-white"
              }`}
            >
              {displayValue}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
