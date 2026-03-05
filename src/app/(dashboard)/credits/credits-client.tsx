"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Search,
  AlertTriangle,
  CheckCircle,
  Users,
  DollarSign,
  Phone,
  Banknote,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getCredits, recordPayment } from "@/actions/credits";
import { getCreditStats } from "@/actions/credits";
import { useMode } from "@/contexts/mode-context";
import { MEDICINE_CATEGORIES, BEAUTY_CATEGORIES } from "@/lib/constants";
import type { CreditWithBalance } from "@/actions/credits";
import type { AppMode } from "@/types";
import { toast } from "sonner";

type CreditFilter = "outstanding" | "settled" | "all";

const modeCategoriesMap = {
  pharmacy: [...MEDICINE_CATEGORIES],
  beauty: [...BEAUTY_CATEGORIES],
} as const;

interface CreditsClientProps {
  credits: CreditWithBalance[];
  stats: {
    totalOutstanding: number;
    totalClients: number;
    totalSettled: number;
  };
  userRole: string;
}

export function CreditsClient({
  credits: initial,
  stats,
  userRole,
}: CreditsClientProps) {
  const { mode } = useMode();
  const modeCategories = [...modeCategoriesMap[mode]];
  const cacheRef = useRef<
    Record<
      string,
      {
        credits: CreditWithBalance[];
        stats: {
          totalOutstanding: number;
          totalClients: number;
          totalSettled: number;
        };
      }
    >
  >({
    [`${mode}:outstanding`]: { credits: initial, stats },
  });
  const requestIdRef = useRef(0);
  const [credits, setCredits] = useState<CreditWithBalance[]>(initial);
  const [statsState, setStatsState] = useState(stats);
  const [filter, setFilter] = useState<CreditFilter>("outstanding");
  const [search, setSearch] = useState("");
  const [payDialog, setPayDialog] = useState<CreditWithBalance | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);

  function getCacheKey(targetMode: AppMode, targetFilter: CreditFilter) {
    return `${targetMode}:${targetFilter}`;
  }

  async function loadCredits(f: CreditFilter) {
    setFilter(f);

    const cacheKey = getCacheKey(mode, f);
    const oppositeMode: AppMode = mode === "pharmacy" ? "beauty" : "pharmacy";
    const oppositeKey = getCacheKey(oppositeMode, f);
    const cached = cacheRef.current[cacheKey];
    if (cached) {
      setCredits(cached.credits);
      setStatsState(cached.stats);
      if (!cacheRef.current[oppositeKey]) {
        Promise.all([
          getCredits(f, [...modeCategoriesMap[oppositeMode]]),
          getCreditStats([...modeCategoriesMap[oppositeMode]]),
        ])
          .then(([prefetchCredits, prefetchStats]) => {
            cacheRef.current[oppositeKey] = {
              credits: prefetchCredits,
              stats: prefetchStats,
            };
          })
          .catch(() => {});
      }
      return;
    } else {
      setCredits([]);
      setStatsState({ totalOutstanding: 0, totalClients: 0, totalSettled: 0 });
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    const [updatedCredits, updatedStats] = await Promise.all([
      getCredits(f, modeCategories),
      getCreditStats(modeCategories),
    ]);

    if (requestId !== requestIdRef.current) return;

    cacheRef.current[cacheKey] = {
      credits: updatedCredits,
      stats: updatedStats,
    };
    setCredits(updatedCredits);
    setStatsState(updatedStats);
  }

  useEffect(() => {
    const cacheKey = getCacheKey(mode, filter);
    const oppositeMode: AppMode = mode === "pharmacy" ? "beauty" : "pharmacy";
    const oppositeKey = getCacheKey(oppositeMode, filter);
    const cached = cacheRef.current[cacheKey];
    if (cached) {
      setCredits(cached.credits);
      setStatsState(cached.stats);
      if (!cacheRef.current[oppositeKey]) {
        Promise.all([
          getCredits(filter, [...modeCategoriesMap[oppositeMode]]),
          getCreditStats([...modeCategoriesMap[oppositeMode]]),
        ])
          .then(([prefetchCredits, prefetchStats]) => {
            cacheRef.current[oppositeKey] = {
              credits: prefetchCredits,
              stats: prefetchStats,
            };
          })
          .catch(() => {});
      }
      return;
    } else {
      setCredits([]);
      setStatsState({ totalOutstanding: 0, totalClients: 0, totalSettled: 0 });
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    Promise.all([
      getCredits(filter, modeCategories),
      getCreditStats(modeCategories),
    ])
      .then(([updatedCredits, updatedStats]) => {
        if (requestId !== requestIdRef.current) return;

        cacheRef.current[cacheKey] = {
          credits: updatedCredits,
          stats: updatedStats,
        };
        setCredits(updatedCredits);
        setStatsState(updatedStats);
        if (!cacheRef.current[oppositeKey]) {
          Promise.all([
            getCredits(filter, [...modeCategoriesMap[oppositeMode]]),
            getCreditStats([...modeCategoriesMap[oppositeMode]]),
          ])
            .then(([prefetchCredits, prefetchStats]) => {
              cacheRef.current[oppositeKey] = {
                credits: prefetchCredits,
                stats: prefetchStats,
              };
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
      });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePayment() {
    if (!payDialog) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    if (amount > payDialog.balance) {
      toast.error(
        `Amount exceeds outstanding balance of ${formatCurrency(payDialog.balance)}`,
      );
      return;
    }
    setPaying(true);
    const result = await recordPayment(payDialog.id, amount);
    setPaying(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.isSettled ? "Credit fully settled!" : "Payment recorded!",
    );
    setPayDialog(null);
    setPayAmount("");
    const [updatedCredits, updatedStats] = await Promise.all([
      getCredits(filter, modeCategories),
      getCreditStats(modeCategories),
    ]);
    cacheRef.current[getCacheKey(mode, filter)] = {
      credits: updatedCredits,
      stats: updatedStats,
    };
    setCredits(updatedCredits);
    setStatsState(updatedStats);
  }

  const filtered = credits.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.customer_name.toLowerCase().includes(q) ||
      (c.customer_phone ?? "").includes(q) ||
      (c.medicine_details ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
            Credit Accounts
          </h1>
          <p className="text-muted-foreground text-sm">
            Track {mode === "beauty" ? "beauty" : "pharmacy"} customers who owe
            payment
          </p>
        </div>
        <Badge variant="outline" className="border-amber-500 text-amber-400">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {statsState.totalClients} outstanding
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="glass-card p-5"
          style={{ boxShadow: "0 0 20px rgba(245,158,11,0.15)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <DollarSign className="h-5 w-5 text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {formatCurrency(statsState.totalOutstanding)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total Outstanding
          </p>
        </div>
        <div
          className="glass-card p-5"
          style={{ boxShadow: "0 0 20px rgba(0,255,224,0.1)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {statsState.totalClients}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Active Credit Customers
          </p>
        </div>
        <div
          className="glass-card p-5"
          style={{ boxShadow: "0 0 20px rgba(34,197,94,0.1)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-400">
            {formatCurrency(statsState.totalSettled)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total Settled (All Time)
          </p>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs
          value={filter}
          onValueChange={(v) =>
            loadCredits(v as "outstanding" | "settled" | "all")
          }
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-card border border-border">
            <TabsTrigger
              value="outstanding"
              className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
            >
              Outstanding
            </TabsTrigger>
            <TabsTrigger
              value="settled"
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
            >
              Settled
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search by name, phone, or ${mode === "beauty" ? "product" : "medicine"}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background/50 border-border focus:border-primary"
          />
        </div>
      </div>

      {/* Credits Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-400" />
            {filter === "outstanding"
              ? "Outstanding Credits"
              : filter === "settled"
                ? "Settled Credits"
                : "All Credits"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-10">
              {search
                ? "No credits matching your search"
                : `No ${filter === "all" ? "" : filter} credits found`}
            </p>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {filtered.map((credit) => (
                  <div
                    key={credit.id}
                    className="rounded-lg border border-border bg-background/40 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-medium text-sm">
                          {credit.customer_name}
                        </p>
                        {credit.customer_phone && (
                          <p className="text-muted-foreground text-xs mt-0.5">
                            {credit.customer_phone}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          credit.is_settled
                            ? "border-green-500 text-green-500"
                            : "border-amber-500 text-amber-400"
                        }
                      >
                        {credit.is_settled ? "Settled" : "Pending"}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <p>
                        Total:{" "}
                        <span className="text-white">
                          {formatCurrency(credit.amount)}
                        </span>
                      </p>
                      <p>
                        Paid:{" "}
                        <span className="text-green-400">
                          {formatCurrency(credit.amount_paid)}
                        </span>
                      </p>
                      <p>
                        Balance:{" "}
                        <span
                          className={
                            credit.balance > 0
                              ? "text-amber-400"
                              : "text-green-400"
                          }
                        >
                          {formatCurrency(credit.balance)}
                        </span>
                      </p>
                    </div>

                    {!credit.is_settled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary/80 h-8 px-2"
                        onClick={() => {
                          setPayDialog(credit);
                          setPayAmount(credit.balance.toString());
                        }}
                      >
                        <Banknote className="h-3 w-3 mr-1" />
                        Record Payment
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">
                        Customer
                      </TableHead>
                      <TableHead className="text-muted-foreground hidden md:table-cell">
                        {mode === "beauty" ? "Products" : "Medicines"}
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Total
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Paid
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Balance
                      </TableHead>
                      <TableHead className="text-muted-foreground hidden sm:table-cell">
                        Date
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-muted-foreground text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((credit) => (
                      <TableRow key={credit.id} className="border-border">
                        <TableCell>
                          <div>
                            <p className="text-white font-medium text-sm">
                              {credit.customer_name}
                            </p>
                            {credit.customer_phone && (
                              <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" />
                                {credit.customer_phone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-xs max-w-[200px] truncate hidden md:table-cell"
                          title={credit.medicine_details ?? "-"}
                        >
                          {credit.medicine_details || "-"}
                        </TableCell>
                        <TableCell className="text-white font-medium text-sm">
                          {formatCurrency(credit.amount)}
                        </TableCell>
                        <TableCell className="text-green-400 text-sm">
                          {formatCurrency(credit.amount_paid)}
                        </TableCell>
                        <TableCell
                          className={`font-bold text-sm ${credit.balance > 0 ? "text-amber-400" : "text-green-400"}`}
                        >
                          {formatCurrency(credit.balance)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs hidden sm:table-cell">
                          {formatDateTime(credit.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              credit.is_settled
                                ? "border-green-500 text-green-500"
                                : "border-amber-500 text-amber-400"
                            }
                          >
                            {credit.is_settled ? "Settled" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!credit.is_settled && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary/80 h-7 px-2"
                              onClick={() => {
                                setPayDialog(credit);
                                setPayAmount(credit.balance.toString());
                              }}
                            >
                              <Banknote className="h-3 w-3 mr-1" />
                              Pay
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog
        open={!!payDialog}
        onOpenChange={(o) => {
          if (!o) {
            setPayDialog(null);
            setPayAmount("");
          }
        }}
      >
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white font-[family-name:var(--font-sans)]">
              Record Payment
            </DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-background/50 border border-border space-y-1">
                <p className="text-white font-semibold">
                  {payDialog.customer_name}
                </p>
                {payDialog.customer_phone && (
                  <p className="text-muted-foreground text-sm">
                    {payDialog.customer_phone}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {payDialog.medicine_details}
                </p>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Credit</span>
                <span className="text-white font-medium">
                  {formatCurrency(payDialog.amount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Already Paid</span>
                <span className="text-green-400 font-medium">
                  {formatCurrency(payDialog.amount_paid)}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">Outstanding</span>
                <span className="text-amber-400 font-bold text-base">
                  {formatCurrency(payDialog.balance)}
                </span>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">
                  Amount Being Paid (KES)
                </Label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="bg-background border-border text-white mt-1"
                  min={1}
                  max={payDialog.balance}
                  placeholder={payDialog.balance.toString()}
                />
                {parseFloat(payAmount) >= payDialog.balance && (
                  <p className="text-xs text-green-400 mt-1">
                    ✓ This will fully settle the credit
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setPayDialog(null);
                setPayAmount("");
              }}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={paying}
              className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
            >
              {paying ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
