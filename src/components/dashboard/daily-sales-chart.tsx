"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { MedicineDailySales } from "@/types";

interface DailySalesChartProps {
  data: MedicineDailySales[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[rgba(0,255,224,0.2)] bg-[#1A1A1A] p-3 shadow-lg">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-primary">
          {payload[0].value.toLocaleString()} units
        </p>
      </div>
    );
  }
  return null;
}

export function DailySalesChart({ data }: DailySalesChartProps) {
  const todayKey = new Date().toISOString().split("T")[0];
  const totalUnits = data.reduce((s, d) => s + d.units_sold, 0);
  const todayUnits = data.find((d) => d.date === todayKey)?.units_sold ?? 0;

  // Format dates for display (show last 7 as day labels, others as date)
  const formatted = data.map((d, i) => ({
    ...d,
    label:
      i >= data.length - 7
        ? new Date(d.date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })
        : new Date(d.date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          }),
  }));

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold font-[family-name:var(--font-sans)] text-white">
            Units Sold <span className="text-primary">Per Day</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 14 days · {totalUnits.toLocaleString()} total units
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">
            {todayUnits.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">units today</p>
        </div>
      </div>

      {totalUnits === 0 ? (
        <div className="h-[220px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No sales recorded yet — start selling to see data
          </p>
        </div>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} barCategoryGap="30%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#B4B4B4", fontSize: 11 }}
                interval={1}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#B4B4B4", fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,255,224,0.05)" }} />
              <Bar dataKey="units_sold" radius={[4, 4, 0, 0]}>
                {formatted.map((entry) => (
                  <Cell
                    key={entry.date}
                    fill={
                      entry.date === todayKey
                        ? "#00FFE0"
                        : "rgba(0,255,224,0.35)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
