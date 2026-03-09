"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RevenueDataPoint } from "@/types";

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[rgba(0,255,224,0.2)] bg-[#1A1A1A] p-3 shadow-lg">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-primary">
          KES {payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="glass-card p-6">
      <h3 className="text-base font-semibold font-[family-name:var(--font-sans)] text-white mb-4">
        Revenue Trend <span className="text-primary">(30 Days)</span>
      </h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00FFE0" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00FFE0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#B4B4B4", fontSize: 12 }}
              minTickGap={20}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#B4B4B4", fontSize: 12 }}
              width={44}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#00FFE0"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
