"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMode } from "@/contexts/mode-context";
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
  saveReport,
  getSavedReports,
} from "@/actions/reports";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  exportToCSV,
} from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  DollarSign,
  ShoppingCart,
  Loader2,
  Building2,
  Download,
  FileText,
  History,
  FileDown,
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
import { toast } from "sonner";
import type { User } from "@/types/database";

interface ReportsClientProps {
  user: User & { branch?: { name: string } | null };
}

// ---- PDF helper (client-side, lazy-loaded) -------------------------
async function downloadPDF(
  title: string,
  subtitle: string,
  summaryRows: [string, string][],
  tableHead: string[],
  tableBody: (string | number)[][],
) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header
  doc.setFillColor(0, 255, 224);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(10, 10, 10);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("LK PharmaCare", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Multi-Branch Pharmacy Operating System", 105, 12, {
    align: "center",
  });
  doc.text(`Generated: ${new Date().toLocaleString("en-KE")}`, 196, 12, {
    align: "right",
  });

  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, 14, 37);

  let startY = 44;

  // Summary table
  if (summaryRows.length > 0) {
    autoTable(doc, {
      startY,
      head: [["Metric", "Value"]],
      body: summaryRows,
      theme: "grid",
      headStyles: {
        fillColor: [0, 184, 169],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });
    startY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Data table
  if (tableBody.length > 0) {
    autoTable(doc, {
      startY,
      head: [tableHead],
      body: tableBody,
      theme: "striped",
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [0, 255, 224],
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `LK PharmaCare — Confidential | Page ${i} of ${pageCount}`,
      105,
      290,
      { align: "center" },
    );
  }

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export function ReportsClient({ user }: ReportsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const { mode } = useMode();
  const today = new Date().toISOString().slice(0, 10);

  const [dailyDate, setDailyDate] = useState(today);
  const [dailyReport, setDailyReport] = useState<any>(null);

  const [monthYear, setMonthYear] = useState(today.slice(0, 7));
  const [monthlyReport, setMonthlyReport] = useState<any>(null);

  const [topStart, setTopStart] = useState(today);
  const [topEnd, setTopEnd] = useState(today);
  const [topSelling, setTopSelling] = useState<any[]>([]);

  const [branchMonth, setBranchMonth] = useState(today.slice(0, 7));
  const [branchData, setBranchData] = useState<any[]>([]);

  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    setLoadingSaved(true);
    getSavedReports().then((data) => {
      setSavedReports(data);
      setLoadingSaved(false);
    });
  }, []);

  async function persistReport(
    type: string,
    title: string,
    period: string,
    summary: Record<string, unknown>,
    data: unknown[],
  ) {
    setIsSaving(true);
    await saveReport({
      report_type: type,
      title,
      period,
      summary,
      reportData: data,
    });
    const updated = await getSavedReports();
    setSavedReports(updated);
    setIsSaving(false);
    toast.success(`Report saved & emailed`);
  }

  function loadDailyReport() {
    startTransition(async () => {
      const data = await getDailySalesReport(dailyDate);
      setDailyReport(data);
      if (data?.summary) {
        const summary = {
          "Total Revenue": formatCurrency(data.summary.totalRevenue),
          "Total Sales": String(data.summary.totalSales),
          Voided: String(data.summary.totalVoided),
          ...Object.fromEntries(
            Object.entries(
              data.summary.paymentBreakdown as Record<string, number>,
            ).map(([k, v]) => [`Payment (${k})`, formatCurrency(v)]),
          ),
        };
        await persistReport(
          "daily",
          `Daily Report — ${formatDate(dailyDate)}`,
          dailyDate,
          summary,
          data.sales,
        );
      }
    });
  }

  function loadMonthlyReport() {
    startTransition(async () => {
      const [y, m] = monthYear.split("-").map(Number);
      const data = await getMonthlySalesReport(y, m);
      setMonthlyReport(data);
      if (data?.summary) {
        const summary = {
          "Total Revenue": formatCurrency(data.summary.totalRevenue),
          "Total Sales": String(data.summary.totalSales),
          "Avg Daily Revenue": formatCurrency(data.summary.avgDailyRevenue),
        };
        await persistReport(
          "monthly",
          `Monthly Report — ${monthYear}`,
          monthYear,
          summary,
          data.dailyData,
        );
      }
    });
  }

  function loadTopSelling() {
    startTransition(async () => {
      const data = await getTopSellingReport(topStart, topEnd);
      setTopSelling(data);
      if (data.length > 0) {
        const totalRevenue = data.reduce(
          (sum: number, i: any) => sum + i.totalRevenue,
          0,
        );
        const summary = {
          Period: `${topStart} to ${topEnd}`,
          "Total Medicines": String(data.length),
          "Total Revenue": formatCurrency(totalRevenue),
        };
        await persistReport(
          "top_selling",
          `Top Selling — ${topStart} to ${topEnd}`,
          `${topStart} to ${topEnd}`,
          summary,
          data,
        );
      }
    });
  }

  function loadBranchComparison() {
    startTransition(async () => {
      const [y, m] = branchMonth.split("-").map(Number);
      const data = await getBranchComparisonReport(y, m);
      setBranchData(data);
      if (data.length > 0) {
        const totalRevenue = data.reduce(
          (sum: number, b: any) => sum + b.revenue,
          0,
        );
        const summary = {
          Period: branchMonth,
          Branches: String(data.length),
          "Total Revenue": formatCurrency(totalRevenue),
        };
        await persistReport(
          "branches",
          `Branch Comparison — ${branchMonth}`,
          branchMonth,
          summary,
          data,
        );
      }
    });
  }

  function downloadDailyPDF() {
    if (!dailyReport?.summary) return;
    const summaryRows: [string, string][] = [
      ["Total Revenue", formatCurrency(dailyReport.summary.totalRevenue)],
      ["Total Sales", String(dailyReport.summary.totalSales)],
      ["Voided", String(dailyReport.summary.totalVoided)],
      ...Object.entries(
        dailyReport.summary.paymentBreakdown as Record<string, number>,
      ).map(
        ([k, v]) =>
          [`Payment (${k.toUpperCase()})`, formatCurrency(v)] as [
            string,
            string,
          ],
      ),
    ];
    const tableBody = dailyReport.sales.map((s: any) => [
      s.receipt_number ?? "",
      s.cashier?.full_name ?? "—",
      formatCurrency(s.total_amount),
      s.payment_method?.toUpperCase() ?? "",
      formatDateTime(s.created_at),
      s.is_voided ? "Voided" : "Completed",
    ]);
    downloadPDF(
      `Daily Report — ${formatDate(dailyDate)}`,
      `Sales on ${dailyDate}`,
      summaryRows,
      ["Receipt #", "Cashier", "Amount", "Payment", "Time", "Status"],
      tableBody,
    );
  }

  function downloadMonthlyPDF() {
    if (!monthlyReport?.summary) return;
    const summaryRows: [string, string][] = [
      ["Total Revenue", formatCurrency(monthlyReport.summary.totalRevenue)],
      ["Total Sales", String(monthlyReport.summary.totalSales)],
      [
        "Avg Daily Revenue",
        formatCurrency(monthlyReport.summary.avgDailyRevenue),
      ],
    ];
    const tableBody = monthlyReport.dailyData.map((d: any) => [
      d.date,
      d.count ?? "",
      formatCurrency(d.revenue),
    ]);
    downloadPDF(
      `Monthly Report — ${monthYear}`,
      `Daily breakdown for ${monthYear}`,
      summaryRows,
      ["Date", "Sales", "Revenue"],
      tableBody,
    );
  }

  function downloadTopSellingPDF() {
    if (!topSelling.length) return;
    const summaryRows: [string, string][] = [
      ["Period", `${topStart} to ${topEnd}`],
      ["Total Medicines", String(topSelling.length)],
      [
        "Total Revenue",
        formatCurrency(
          topSelling.reduce((s: number, i: any) => s + i.totalRevenue, 0),
        ),
      ],
    ];
    const tableBody = topSelling.map((item: any, i: number) => [
      i + 1,
      item.name,
      item.category,
      item.totalQty,
      formatCurrency(item.totalRevenue),
    ]);
    downloadPDF(
      `Top Selling — ${topStart} to ${topEnd}`,
      "Revenue by Medicine",
      summaryRows,
      ["#", "Medicine", "Category", "Qty Sold", "Revenue"],
      tableBody,
    );
  }

  function downloadBranchesPDF() {
    if (!branchData.length) return;
    const summaryRows: [string, string][] = [
      ["Period", branchMonth],
      ["Branches", String(branchData.length)],
      [
        "Total Revenue",
        formatCurrency(
          branchData.reduce((s: number, b: any) => s + b.revenue, 0),
        ),
      ],
    ];
    const tableBody = branchData.map((b: any) => [
      b.name,
      b.salesCount,
      formatCurrency(b.revenue),
    ]);
    downloadPDF(
      `Branch Comparison — ${branchMonth}`,
      "Revenue per branch",
      summaryRows,
      ["Branch", "Sales", "Revenue"],
      tableBody,
    );
  }

  const reportTypeLabel: Record<string, string> = {
    daily: "Daily",
    monthly: "Monthly",
    top_selling: "Top Selling",
    branches: "Branches",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
          Reports
        </h1>
        <p className="text-muted-foreground text-sm">
          Sales analytics and performance data ·{" "}
          <span className="text-primary/70">
            {mode === "beauty" ? "💫 Beauty & Clothing" : "💊 Pharmacy"}
          </span>
        </p>
      </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList className="bg-background border border-border w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger
            value="daily"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs sm:text-sm"
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            Daily
          </TabsTrigger>
          <TabsTrigger
            value="monthly"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs sm:text-sm"
          >
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Monthly
          </TabsTrigger>
          <TabsTrigger
            value="top-selling"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs sm:text-sm"
          >
            <TrendingUp className="h-4 w-4 mr-1.5" />
            Top Selling
          </TabsTrigger>
          {user.role === "admin" && (
            <TabsTrigger
              value="branches"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs sm:text-sm"
            >
              <Building2 className="h-4 w-4 mr-1.5" />
              Branches
            </TabsTrigger>
          )}
          <TabsTrigger
            value="saved"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs sm:text-sm"
          >
            <History className="h-4 w-4 mr-1.5" />
            Saved
          </TabsTrigger>
        </TabsList>

        {/* ── Daily Report ─────────────────────────────────── */}
        <TabsContent value="daily" className="space-y-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex gap-3 items-end flex-wrap">
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
                  disabled={isPending || isSaving}
                  className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                >
                  {isPending || isSaving ? (
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="glass-card">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">
                      Total Revenue
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(dailyReport.summary.totalRevenue)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Total Sales</p>
                    <p className="text-lg font-bold text-white">
                      {dailyReport.summary.totalSales}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Voided</p>
                    <p className="text-lg font-bold text-destructive">
                      {dailyReport.summary.totalVoided}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground mb-1">
                      Payment
                    </p>
                    <div className="flex flex-col gap-1">
                      {Object.entries(
                        dailyReport.summary.paymentBreakdown as Record<
                          string,
                          number
                        >,
                      ).map(([method, amount]) => (
                        <Badge
                          key={method}
                          variant="outline"
                          className="border-primary text-primary text-xs w-fit"
                        >
                          {method}: {formatCurrency(amount)}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-3">
                  <CardTitle className="text-sm font-semibold text-white">
                    Sales on {formatDate(dailyDate)}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground h-8 text-xs"
                      onClick={() =>
                        exportToCSV(
                          dailyReport.sales.map((s: any) => ({
                            receipt: s.receipt_number,
                            cashier: s.cashier?.full_name ?? "",
                            amount: s.total_amount,
                            payment: s.payment_method,
                            time: s.created_at,
                            status: s.is_voided ? "Voided" : "Completed",
                          })),
                          `daily-sales-${dailyDate}`,
                        )
                      }
                    >
                      <Download className="h-3 w-3 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/40 text-primary h-8 text-xs"
                      onClick={downloadDailyPDF}
                    >
                      <FileDown className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground text-xs pl-4 sm:pl-0">
                            Receipt
                          </TableHead>
                          <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">
                            Cashier
                          </TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">
                            Amount
                          </TableHead>
                          <TableHead className="text-muted-foreground text-xs hidden md:table-cell">
                            Payment
                          </TableHead>
                          <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">
                            Time
                          </TableHead>
                          <TableHead className="text-muted-foreground text-xs">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyReport.sales.map((sale: any) => (
                          <TableRow key={sale.id} className="border-border">
                            <TableCell className="text-white font-mono text-xs pl-4 sm:pl-0">
                              {sale.receipt_number}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs hidden sm:table-cell">
                              {sale.cashier?.full_name ?? "—"}
                            </TableCell>
                            <TableCell className="text-right text-primary font-medium text-xs">
                              {formatCurrency(sale.total_amount)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                              {sale.payment_method}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs hidden sm:table-cell">
                              {formatDateTime(sale.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${sale.is_voided ? "border-destructive text-destructive" : "border-green-500 text-green-500"}`}
                              >
                                {sale.is_voided ? "Voided" : "Done"}
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

        {/* ── Monthly Report ────────────────────────────────── */}
        <TabsContent value="monthly" className="space-y-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex gap-3 items-end flex-wrap">
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
                  disabled={isPending || isSaving}
                  className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                >
                  {isPending || isSaving ? (
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="glass-card">
                  <CardContent className="pt-5">
                    <DollarSign className="h-5 w-5 text-primary mb-1" />
                    <p className="text-xs text-muted-foreground">
                      Monthly Revenue
                    </p>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(monthlyReport.summary.totalRevenue)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-5">
                    <ShoppingCart className="h-5 w-5 text-primary mb-1" />
                    <p className="text-xs text-muted-foreground">Total Sales</p>
                    <p className="text-xl font-bold text-white">
                      {monthlyReport.summary.totalSales}
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-5">
                    <TrendingUp className="h-5 w-5 text-primary mb-1" />
                    <p className="text-xs text-muted-foreground">
                      Avg Daily Revenue
                    </p>
                    <p className="text-xl font-bold text-white">
                      {formatCurrency(monthlyReport.summary.avgDailyRevenue)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {monthlyReport.dailyData.length > 0 && (
                <Card className="glass-card">
                  <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-3">
                    <CardTitle className="text-sm font-semibold text-white">
                      Daily Revenue Trend
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/40 text-primary h-8 text-xs"
                      onClick={downloadMonthlyPDF}
                    >
                      <FileDown className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={monthlyReport.dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => v.slice(8)}
                          stroke="#B4B4B4"
                          fontSize={11}
                        />
                        <YAxis
                          stroke="#B4B4B4"
                          fontSize={11}
                          width={60}
                          tickFormatter={(v) => `${v / 1000}k`}
                        />
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

        {/* ── Top Selling ───────────────────────────────────── */}
        <TabsContent value="top-selling" className="space-y-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs text-muted-foreground">From</label>
                  <Input
                    type="date"
                    value={topStart}
                    onChange={(e) => setTopStart(e.target.value)}
                    className="bg-background border-border text-white w-full"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
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
                  disabled={isPending || isSaving}
                  className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                >
                  {isPending || isSaving ? (
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
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-white">
                    Revenue by Medicine (Top 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topSelling.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="name"
                        stroke="#B4B4B4"
                        fontSize={10}
                        angle={-30}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        stroke="#B4B4B4"
                        fontSize={11}
                        width={60}
                        tickFormatter={(v) => `${v / 1000}k`}
                      />
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

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-3">
                  <CardTitle className="text-sm font-semibold text-white">
                    Full Ranking
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/40 text-primary h-8 text-xs"
                    onClick={downloadTopSellingPDF}
                  >
                    <FileDown className="h-3 w-3 mr-1" />
                    PDF
                  </Button>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground text-xs pl-4 sm:pl-0 w-8">
                            #
                          </TableHead>
                          <TableHead className="text-muted-foreground text-xs">
                            Medicine
                          </TableHead>
                          <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">
                            Category
                          </TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">
                            Qty
                          </TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">
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
                            <TableCell className="text-muted-foreground text-xs pl-4 sm:pl-0">
                              {i + 1}
                            </TableCell>
                            <TableCell className="text-white font-medium text-xs">
                              {item.name}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge
                                variant="outline"
                                className="border-border text-muted-foreground text-xs"
                              >
                                {item.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-white text-xs">
                              {item.totalQty}
                            </TableCell>
                            <TableCell className="text-right text-primary font-medium text-xs">
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

        {/* ── Branch Comparison ─────────────────────────────── */}
        {user.role === "admin" && (
          <TabsContent value="branches" className="space-y-4">
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex gap-3 items-end flex-wrap">
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
                    disabled={isPending || isSaving}
                    className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                  >
                    {isPending || isSaving ? (
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
                  <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-3">
                    <CardTitle className="text-sm font-semibold text-white">
                      Branch Revenue Comparison
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/40 text-primary h-8 text-xs"
                      onClick={downloadBranchesPDF}
                    >
                      <FileDown className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={branchData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" stroke="#B4B4B4" fontSize={12} />
                        <YAxis
                          stroke="#B4B4B4"
                          fontSize={11}
                          width={60}
                          tickFormatter={(v) => `${v / 1000}k`}
                        />
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
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-muted-foreground text-xs">
                              Branch
                            </TableHead>
                            <TableHead className="text-muted-foreground text-xs text-right">
                              Sales
                            </TableHead>
                            <TableHead className="text-muted-foreground text-xs text-right">
                              Revenue
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {branchData.map((b) => (
                            <TableRow key={b.id} className="border-border">
                              <TableCell className="text-white font-medium text-sm">
                                {b.name}
                              </TableCell>
                              <TableCell className="text-right text-white text-sm">
                                {b.salesCount}
                              </TableCell>
                              <TableCell className="text-right text-primary font-medium text-sm">
                                {formatCurrency(b.revenue)}
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
        )}

        {/* ── Saved Reports ─────────────────────────────────── */}
        <TabsContent value="saved" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Report History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSaved ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : savedReports.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No reports generated yet.</p>
                  <p className="text-xs mt-1">
                    Generate a report from any tab — it will be saved here
                    automatically.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground text-xs">
                          Report
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs">
                          Type
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">
                          Period
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs hidden md:table-cell">
                          Generated
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs">
                          Summary
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedReports.map((r: any) => (
                        <TableRow key={r.id} className="border-border">
                          <TableCell className="text-white font-medium text-xs max-w-[140px] truncate">
                            {r.title}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="border-primary/40 text-primary text-xs"
                            >
                              {reportTypeLabel[r.report_type] ?? r.report_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs hidden sm:table-cell">
                            {r.period}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                            {r.created_at ? formatDateTime(r.created_at) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col gap-0.5">
                              {Object.entries(
                                r.summary as Record<string, string>,
                              )
                                .slice(0, 2)
                                .map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="text-muted-foreground"
                                  >
                                    <span className="text-white/70">{k}:</span>{" "}
                                    {v}
                                  </span>
                                ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
