"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDailySalesReport,
  getMonthlySalesReport,
  getTopSellingReport,
  getBranchComparisonReport,
} from "@/actions/reports";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  DollarSign,
  ShoppingCart,
  Loader2,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import type { User } from "@/types/database";

interface ReportsClientProps {
  user: User & { branch?: { name: string } | null };
}

export function ReportsClient({ user }: ReportsClientProps) {
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  // Daily report state
  const [dailyDate, setDailyDate] = useState(today);
  const [dailyReport, setDailyReport] = useState<any>(null);

  // Monthly report state
  const [monthYear, setMonthYear] = useState(today.slice(0, 7));
  const [monthlyReport, setMonthlyReport] = useState<any>(null);

  // Top selling state
  const [topStart, setTopStart] = useState(today);
  const [topEnd, setTopEnd] = useState(today);
  const [topSelling, setTopSelling] = useState<any[]>([]);

  // Branch comparison state
  const [branchMonth, setBranchMonth] = useState(today.slice(0, 7));
  const [branchData, setBranchData] = useState<any[]>([]);

  function loadDailyReport() {
    startTransition(async () => {
      const data = await getDailySalesReport(dailyDate);
      setDailyReport(data);
    });
  }

  function loadMonthlyReport() {
    startTransition(async () => {
      const [y, m] = monthYear.split("-").map(Number);
      const data = await getMonthlySalesReport(y, m);
      setMonthlyReport(data);
    });
  }

  function loadTopSelling() {
    startTransition(async () => {
      const data = await getTopSellingReport(topStart, topEnd);
      setTopSelling(data);
    });
  }

  function loadBranchComparison() {
    startTransition(async () => {
      const [y, m] = branchMonth.split("-").map(Number);
      const data = await getBranchComparisonReport(y, m);
      setBranchData(data);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
          Reports
        </h1>
        <p className="text-muted-foreground text-sm">
          Sales analytics and performance data
        </p>
      </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList className="bg-background border border-border w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger
            value="daily"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Daily
          </TabsTrigger>
          <TabsTrigger
            value="monthly"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Monthly
          </TabsTrigger>
          <TabsTrigger
            value="top-selling"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Top Selling
          </TabsTrigger>
          {user.role === "admin" && (
            <TabsTrigger
              value="branches"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Branches
            </TabsTrigger>
          )}
        </TabsList>

        {/* Daily Report */}
        <TabsContent value="daily" className="space-y-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Input
                    type="date"
                    value={dailyDate}
                    onChange={(e) => setDailyDate(e.target.value)}
                    className="bg-background border-border text-white w-full"
                  />
                </div>
                <Button
                  onClick={loadDailyReport}
                  disabled={isPending}
                  className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {dailyReport?.summary && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="glass-card">
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">
                      Total Revenue
                    </p>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(dailyReport.summary.totalRevenue)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Total Sales</p>
                    <p className="text-xl font-bold text-white">
                      {dailyReport.summary.totalSales}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Voided</p>
                    <p className="text-xl font-bold text-destructive">
                      {dailyReport.summary.totalVoided}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Payment</p>
                    <div className="flex gap-2 mt-1">
                      {Object.entries(
                        dailyReport.summary.paymentBreakdown as Record<
                          string,
                          number
                        >,
                      ).map(([method, amount]) => (
                        <Badge
                          key={method}
                          variant="outline"
                          className="border-primary text-primary"
                        >
                          {method}: {formatCurrency(amount)}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sales table */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base text-white">
                    Sales on {formatDate(dailyDate)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-6 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">
                            Receipt
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Cashier
                          </TableHead>
                          <TableHead className="text-muted-foreground text-right">
                            Amount
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Time
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyReport.sales.map((sale: any) => (
                          <TableRow key={sale.id} className="border-border">
                            <TableCell className="text-white font-mono text-xs">
                              {sale.receipt_number}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {sale.cashier?.full_name ?? "—"}
                            </TableCell>
                            <TableCell className="text-right text-primary font-medium">
                              {formatCurrency(sale.total_amount)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {formatDateTime(sale.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  sale.is_voided
                                    ? "border-destructive text-destructive"
                                    : "border-green-500 text-green-500"
                                }
                              >
                                {sale.is_voided ? "Voided" : "Completed"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Monthly Report */}
        <TabsContent value="monthly" className="space-y-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground">Month</label>
                  <Input
                    type="month"
                    value={monthYear}
                    onChange={(e) => setMonthYear(e.target.value)}
                    className="bg-background border-border text-white w-full"
                  />
                </div>
                <Button
                  onClick={loadMonthlyReport}
                  disabled={isPending}
                  className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {monthlyReport?.summary && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="glass-card">
                  <CardContent className="pt-6">
                    <DollarSign className="h-5 w-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Monthly Revenue
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(monthlyReport.summary.totalRevenue)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6">
                    <ShoppingCart className="h-5 w-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">Total Sales</p>
                    <p className="text-2xl font-bold text-white">
                      {monthlyReport.summary.totalSales}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6">
                    <TrendingUp className="h-5 w-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Avg Daily Revenue
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(monthlyReport.summary.avgDailyRevenue)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly chart */}
              {monthlyReport.dailyData.length > 0 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-base text-white">
                      Daily Revenue Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={monthlyReport.dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => v.slice(8)}
                          stroke="#B4B4B4"
                          fontSize={12}
                        />
                        <YAxis stroke="#B4B4B4" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1A1A1A",
                            border: "1px solid #333",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                          formatter={(v: number | undefined) => [
                            formatCurrency(v ?? 0),
                            "Revenue",
                          ]}
                        />
                        <defs>
                          <linearGradient
                            id="monthGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#00FFE0"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#00FFE0"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#00FFE0"
                          fill="url(#monthGrad)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Top Selling */}
        <TabsContent value="top-selling" className="space-y-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground">From</label>
                  <Input
                    type="date"
                    value={topStart}
                    onChange={(e) => setTopStart(e.target.value)}
                    className="bg-background border-border text-white w-full"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground">To</label>
                  <Input
                    type="date"
                    value={topEnd}
                    onChange={(e) => setTopEnd(e.target.value)}
                    className="bg-background border-border text-white w-full"
                  />
                </div>
                <Button
                  onClick={loadTopSelling}
                  disabled={isPending}
                  className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {topSelling.length > 0 && (
            <>
              {/* Bar chart */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base text-white">
                    Revenue by Medicine
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topSelling.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="name"
                        stroke="#B4B4B4"
                        fontSize={11}
                        angle={-30}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis stroke="#B4B4B4" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1A1A1A",
                          border: "1px solid #333",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        formatter={(v: number | undefined) => [
                          formatCurrency(v ?? 0),
                          "Revenue",
                        ]}
                      />
                      <Bar
                        dataKey="totalRevenue"
                        fill="#00FFE0"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Table */}
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">
                            #
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Medicine
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Category
                          </TableHead>
                          <TableHead className="text-muted-foreground text-right">
                            Qty Sold
                          </TableHead>
                          <TableHead className="text-muted-foreground text-right">
                            Revenue
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topSelling.map((item, i) => (
                          <TableRow
                            key={item.medicine_id}
                            className="border-border"
                          >
                            <TableCell className="text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell className="text-white font-medium">
                              {item.name}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="border-border text-muted-foreground"
                              >
                                {item.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-white">
                              {item.totalQty}
                            </TableCell>
                            <TableCell className="text-right text-primary font-medium">
                              {formatCurrency(item.totalRevenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Branch Comparison */}
        {user.role === "admin" && (
          <TabsContent value="branches" className="space-y-4">
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex gap-4 items-end flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-muted-foreground">
                      Month
                    </label>
                    <Input
                      type="month"
                      value={branchMonth}
                      onChange={(e) => setBranchMonth(e.target.value)}
                      className="bg-background border-border text-white w-full"
                    />
                  </div>
                  <Button
                    onClick={loadBranchComparison}
                    disabled={isPending}
                    className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Generate"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {branchData.length > 0 && (
              <>
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-base text-white">
                      Branch Revenue Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" stroke="#B4B4B4" fontSize={12} />
                        <YAxis stroke="#B4B4B4" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1A1A1A",
                            border: "1px solid #333",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                          formatter={(v: number | undefined) => [
                            formatCurrency(v ?? 0),
                            "Revenue",
                          ]}
                        />
                        <Bar
                          dataKey="revenue"
                          fill="#00FFE0"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">
                            Branch
                          </TableHead>
                          <TableHead className="text-muted-foreground text-right">
                            Sales
                          </TableHead>
                          <TableHead className="text-muted-foreground text-right">
                            Revenue
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {branchData.map((b) => (
                          <TableRow key={b.id} className="border-border">
                            <TableCell className="text-white font-medium">
                              {b.name}
                            </TableCell>
                            <TableCell className="text-right text-white">
                              {b.salesCount}
                            </TableCell>
                            <TableCell className="text-right text-primary font-medium">
                              {formatCurrency(b.revenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
