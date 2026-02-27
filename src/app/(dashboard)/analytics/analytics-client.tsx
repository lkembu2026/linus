"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import {
  getAnalyticsOverview,
  getAnalyticsSalesBreakdown,
  getAnalyticsInventoryHealth,
  getAnalyticsMedicinePerformance,
} from "@/actions/analytics";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Pill,
  AlertTriangle,
  Activity,
  Loader2,
  Users,
  Clock,
  BarChart3,
  Filter,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type {
  AnalyticsFilters,
  AnalyticsPeriod,
  AnalyticsOverview,
  SalesBreakdown,
  InventoryHealth,
  MedicinePerformance,
} from "@/types";
import type { User } from "@/types/database";

interface AnalyticsClientProps {
  user: User & { branch?: { name: string } | null };
  branches: { id: string; name: string }[];
}

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

const CHART_COLORS = [
  "#00FFE0", "#3B82F6", "#8B5CF6", "#F59E0B",
  "#EF4444", "#10B981", "#EC4899", "#14B8A6",
];

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "primary",
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: "primary" | "green" | "amber" | "red" | "blue";
  loading?: boolean;
}) {
  const colours = {
    primary: "text-primary shadow-[0_0_20px_rgba(0,255,224,0.15)]",
    green: "text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    amber: "text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    red: "text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)]",
    blue: "text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.15)]",
  };
  return (
    <div className={`glass-card p-5 ${colours[accent]}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      {loading ? (
        <div className="h-7 w-24 rounded bg-muted/20 animate-pulse" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
      {sub && !loading && (
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[rgba(0,255,224,0.2)] bg-[#1A1A1A] p-3 shadow-lg text-sm">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {currency ? formatCurrency(p.value) : p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function AnalyticsClient({ user, branches }: AnalyticsClientProps) {
  const isAdmin = user.role === "admin" || user.role === "supervisor";
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().setDate(1)).toISOString().split("T")[0];

  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: "month",
    dateFrom: monthStart,
    dateTo: today,
    branchId: isAdmin ? undefined : user.branch_id ?? undefined,
  });

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [salesBreak, setSalesBreak] = useState<SalesBreakdown | null>(null);
  const [inventory, setInventory] = useState<InventoryHealth | null>(null);
  const [medicines, setMedicines] = useState<MedicinePerformance | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(
    (tab: string, f: AnalyticsFilters) => {
      startTransition(async () => {
        if (tab === "overview") {
          setOverview(await getAnalyticsOverview(f));
        } else if (tab === "sales") {
          setSalesBreak(await getAnalyticsSalesBreakdown(f));
        } else if (tab === "inventory") {
          setInventory(await getAnalyticsInventoryHealth(f.branchId));
        } else if (tab === "medicines") {
          setMedicines(await getAnalyticsMedicinePerformance(f));
        }
      });
    },
    [],
  );

  useEffect(() => {
    load(activeTab, filters);
  }, [activeTab, filters, load]);

  function updateFilters(patch: Partial<AnalyticsFilters>) {
    const next = { ...filters, ...patch };
    if (patch.period && patch.period !== "custom") {
      const now = new Date();
      const t = now.toISOString().split("T")[0];
      let f = t;
      if (patch.period === "today") f = t;
      else if (patch.period === "week") {
        const d = new Date(now); d.setDate(d.getDate() - 6);
        f = d.toISOString().split("T")[0];
      } else if (patch.period === "month") {
        const d = new Date(now); d.setDate(1);
        f = d.toISOString().split("T")[0];
      } else if (patch.period === "quarter") {
        const d = new Date(now); d.setMonth(d.getMonth() - 2); d.setDate(1);
        f = d.toISOString().split("T")[0];
      } else if (patch.period === "year") {
        f = `${now.getFullYear()}-01-01`;
      }
      next.dateFrom = f;
      next.dateTo = t;
    }
    setFilters(next);
  }

  const fmtShortDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="space-y-6">
      {/* ── Filter Bar ── */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Period</p>
          <Select
            value={filters.period}
            onValueChange={(v) => updateFilters({ period: v as AnalyticsPeriod })}
          >
            <SelectTrigger className="w-40 h-9 bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filters.period === "custom" && (
          <>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">From</p>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                className="h-9 w-36 bg-background border-border"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">To</p>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilters({ dateTo: e.target.value })}
                className="h-9 w-36 bg-background border-border"
              />
            </div>
          </>
        )}

        {isAdmin && branches.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Branch</p>
            <Select
              value={filters.branchId ?? "all"}
              onValueChange={(v) =>
                updateFilters({ branchId: v === "all" ? undefined : v })
              }
            >
              <SelectTrigger className="w-44 h-9 bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-end gap-2 ml-auto">
          {isPending && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          )}
          <Badge variant="outline" className="border-primary/30 text-primary text-xs">
            <Filter className="h-3 w-3 mr-1" />
            {PERIOD_OPTIONS.find((o) => o.value === filters.period)?.label}
            {filters.period === "custom"
              ? ` · ${fmtShortDate(filters.dateFrom)} – ${fmtShortDate(filters.dateTo)}`
              : ""}
          </Badge>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={(t) => setActiveTab(t)}
        className="space-y-6"
      >
        <TabsList className="bg-card border border-border h-auto flex-wrap gap-1 p-1">
          {[
            { value: "overview", label: "Overview", icon: Activity },
            { value: "sales", label: "Sales", icon: ShoppingCart },
            { value: "inventory", label: "Inventory", icon: Package },
            { value: "medicines", label: "Medicines", icon: Pill },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/20 border border-transparent"
            >
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ──────────────────────── OVERVIEW ─────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Revenue" value={formatCurrency(overview?.totalRevenue ?? 0)} icon={DollarSign} loading={isPending && !overview} />
            <StatCard label="Transactions" value={(overview?.totalSales ?? 0).toLocaleString()} icon={ShoppingCart} accent="blue" loading={isPending && !overview} />
            <StatCard label="Avg Order" value={formatCurrency(overview?.avgOrderValue ?? 0)} icon={BarChart3} accent="blue" loading={isPending && !overview} />
            <StatCard label="Units Sold" value={(overview?.totalUnitsSold ?? 0).toLocaleString()} icon={Package} accent="green" loading={isPending && !overview} />
            <StatCard label="Gross Profit" value={formatCurrency(overview?.totalProfit ?? 0)} icon={TrendingUp} accent="green" loading={isPending && !overview} />
            <StatCard
              label="Profit Margin"
              value={`${(overview?.profitMargin ?? 0).toFixed(1)}%`}
              icon={(overview?.profitMargin ?? 0) >= 20 ? TrendingUp : TrendingDown}
              accent={(overview?.profitMargin ?? 0) >= 20 ? "green" : "amber"}
              loading={isPending && !overview}
            />
          </div>

          {/* Revenue vs Profit chart */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-4">
              Revenue <span className="text-primary">&amp;</span> Profit Trend
            </h3>
            {!overview || overview.revenueByDay.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                No data for selected period
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview.revenueByDay}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00FFE0" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#00FFE0" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: "#B4B4B4", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={fmtShortDate} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#B4B4B4", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip currency />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#B4B4B4" }} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#00FFE0" strokeWidth={2} fill="url(#revGrad)" />
                    <Area type="monotone" dataKey="profit" name="Profit" stroke="#10B981" strokeWidth={2} fill="url(#profGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ──────────────────────── SALES ─────────────────────────────── */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment method */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Payment Methods</h3>
              {!salesBreak || salesBreak.byPaymentMethod.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No data</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesBreak.byPaymentMethod} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#B4B4B4", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="method" tick={{ fill: "#B4B4B4", fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                      <Tooltip content={<ChartTooltip currency />} />
                      <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                        {salesBreak.byPaymentMethod.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Day of week */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Sales by Day of Week</h3>
              {!salesBreak ? (
                <p className="text-sm text-muted-foreground text-center py-10">No data</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesBreak.byDayOfWeek}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: "#B4B4B4", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#B4B4B4", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Transactions" radius={[4, 4, 0, 0]}>
                        {salesBreak.byDayOfWeek.map((_, i) => (
                          <Cell key={i} fill="rgba(0,255,224,0.45)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Hourly heatmap-style bar */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-4">
              <Clock className="inline h-4 w-4 mr-1.5 text-primary" />
              Busiest Hours
            </h3>
            {!salesBreak || salesBreak.byHour.every((h) => h.count === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesBreak.byHour} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fill: "#B4B4B4", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#B4B4B4", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Transactions" radius={[3, 3, 0, 0]}>
                      {salesBreak.byHour.map((h, i) => (
                        <Cell
                          key={i}
                          fill={
                            h.count === Math.max(...salesBreak.byHour.map((x) => x.count))
                              ? "#00FFE0"
                              : "rgba(0,255,224,0.3)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Cashier table */}
          {isAdmin && salesBreak && salesBreak.byCashier.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-4">
                <Users className="inline h-4 w-4 mr-1.5 text-primary" />
                Staff Performance
              </h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Staff</TableHead>
                    <TableHead className="text-muted-foreground text-right">Transactions</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total Sales</TableHead>
                    <TableHead className="text-muted-foreground text-right">Avg / Sale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesBreak.byCashier.map((c, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="font-medium text-white">{c.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{c.count}</TableCell>
                      <TableCell className="text-right text-primary font-semibold">{formatCurrency(c.amount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(c.count > 0 ? c.amount / c.count : 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ──────────────────────── INVENTORY ─────────────────────────── */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Stock Value" value={formatCurrency(inventory?.totalStockValue ?? 0)} icon={DollarSign} loading={isPending && !inventory} />
            <StatCard label="Cost Value" value={formatCurrency(inventory?.totalCostValue ?? 0)} icon={Package} accent="blue" loading={isPending && !inventory} />
            <StatCard label="Potential Profit" value={formatCurrency(inventory?.potentialProfit ?? 0)} icon={TrendingUp} accent="green" loading={isPending && !inventory} />
            <StatCard label="Total Units" value={(inventory?.totalUnits ?? 0).toLocaleString()} icon={Package} accent="amber" loading={isPending && !inventory} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category stock value bar */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Stock Value by Category</h3>
              {!inventory || inventory.categorySummary.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No data</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventory.categorySummary.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#B4B4B4", fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="category" tick={{ fill: "#B4B4B4", fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip content={<ChartTooltip currency />} />
                      <Bar dataKey="value" name="Stock Value" radius={[0, 4, 4, 0]}>
                        {inventory.categorySummary.slice(0, 10).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Near expiry */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-4">
                <AlertTriangle className="inline h-4 w-4 mr-1.5 text-amber-400" />
                Expiring Within 90 Days
              </h3>
              {!inventory || inventory.nearExpiry.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No medicines expiring within 90 days
                </p>
              ) : (
                <div className="overflow-y-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs">Medicine</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Expiry</TableHead>
                        <TableHead className="text-muted-foreground text-xs text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory.nearExpiry.map((m, i) => {
                        const daysLeft = Math.ceil(
                          (new Date(m.expiry_date).getTime() - Date.now()) / 86400000,
                        );
                        return (
                          <TableRow key={i} className="border-border">
                            <TableCell className="text-white text-sm font-medium">{m.name}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  daysLeft <= 30
                                    ? "border-red-500/40 text-red-400 text-xs"
                                    : "border-amber-500/40 text-amber-400 text-xs"
                                }
                              >
                                {new Date(m.expiry_date).toLocaleDateString("en-GB", {
                                  day: "numeric", month: "short", year: "numeric",
                                })}
                                {" "}({daysLeft}d)
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm">
                              {m.quantity_in_stock}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          {/* Category table */}
          {inventory && inventory.categorySummary.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Category Breakdown</h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    <TableHead className="text-muted-foreground text-right">Units</TableHead>
                    <TableHead className="text-muted-foreground text-right">Stock Value</TableHead>
                    <TableHead className="text-muted-foreground text-right">Cost Value</TableHead>
                    <TableHead className="text-muted-foreground text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.categorySummary.map((c, i) => {
                    const margin = c.value > 0 ? ((c.value - c.cost) / c.value) * 100 : 0;
                    return (
                      <TableRow key={i} className="border-border">
                        <TableCell className="font-medium text-white">{c.category}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{c.units.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-primary font-semibold">{formatCurrency(c.value)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(c.cost)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={`text-xs ${margin >= 20 ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400"}`}>
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ──────────────────────── MEDICINES ─────────────────────────── */}
        <TabsContent value="medicines" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top sellers bar */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-4">
                🏆 Top Selling Medicines
              </h3>
              {!medicines || medicines.topSellers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No sales in this period
                </p>
              ) : (
                <div className="space-y-2">
                  {medicines.topSellers.slice(0, 10).map((m, i) => {
                    const max = medicines.topSellers[0].units_sold;
                    const pct = Math.round((m.units_sold / max) * 100);
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white font-medium truncate max-w-[60%]">
                            <span className="text-primary mr-1.5">#{i + 1}</span>
                            {m.name}
                          </span>
                          <span className="text-muted-foreground shrink-0">
                            {m.units_sold} units · {formatCurrency(m.revenue)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-border">
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

            {/* Category performance */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Revenue by Category</h3>
              {!medicines || medicines.categoryPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No sales data</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={medicines.categoryPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#B4B4B4", fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="category" tick={{ fill: "#B4B4B4", fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip content={<ChartTooltip currency />} />
                      <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                        {medicines.categoryPerformance.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Slow movers */}
          {medicines && medicines.slowMovers.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-4">
                <AlertTriangle className="inline h-4 w-4 mr-1.5 text-amber-400" />
                Slow Movers — Not Sold in Period
              </h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Medicine</TableHead>
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    <TableHead className="text-muted-foreground text-right">Stock Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicines.slowMovers.map((m, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="font-medium text-white">{m.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                          {m.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-amber-400 font-semibold">
                          {m.quantity_in_stock}
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">units</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
