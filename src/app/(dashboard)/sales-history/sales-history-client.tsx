"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Clock, XCircle, Search, Receipt } from "lucide-react";
import { voidSale, getRecentSales } from "@/actions/sales";
import { useMode } from "@/contexts/mode-context";
import { MEDICINE_CATEGORIES, BEAUTY_CATEGORIES } from "@/lib/constants";
import type { RecentSale } from "@/actions/sales";
import type { AppMode } from "@/types";
import { toast } from "sonner";

const modeCategoriesMap = {
  pharmacy: [...MEDICINE_CATEGORIES],
  beauty: [...BEAUTY_CATEGORIES],
} as const;

interface SalesHistoryClientProps {
  sales: RecentSale[];
  userRole: string;
}

export function SalesHistoryClient({
  sales: initialSales,
  userRole,
}: SalesHistoryClientProps) {
  const { mode } = useMode();
  const modeCategories = [...modeCategoriesMap[mode]];
  const itemLabel = mode === "beauty" ? "products" : "items";
  const cachedByModeRef = useRef<Record<AppMode, RecentSale[] | undefined>>({
    pharmacy: mode === "pharmacy" ? initialSales : undefined,
    beauty: mode === "beauty" ? initialSales : undefined,
  });
  const requestIdRef = useRef(0);
  const [sales, setSales] = useState<RecentSale[]>(initialSales);
  const [isModeLoading, setIsModeLoading] = useState(false);
  const [search, setSearch] = useState("");

  async function loadModeSales(targetMode: AppMode) {
    return getRecentSales(20, [...modeCategoriesMap[targetMode]]);
  }

  useEffect(() => {
    const cached = cachedByModeRef.current[mode];
    const oppositeMode: AppMode = mode === "pharmacy" ? "beauty" : "pharmacy";
    if (cached) {
      setSales(cached);
      setIsModeLoading(false);
      if (!cachedByModeRef.current[oppositeMode]) {
        loadModeSales(oppositeMode)
          .then((prefetched) => {
            cachedByModeRef.current[oppositeMode] = prefetched;
          })
          .catch(() => {});
      }
      return;
    }

    setIsModeLoading(true);

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    loadModeSales(mode)
      .then((updated) => {
        if (requestId !== requestIdRef.current) return;
        cachedByModeRef.current[mode] = updated;
        setSales(updated);
        setIsModeLoading(false);
        if (!cachedByModeRef.current[oppositeMode]) {
          loadModeSales(oppositeMode)
            .then((prefetched) => {
              cachedByModeRef.current[oppositeMode] = prefetched;
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setIsModeLoading(false);
      });
  }, [mode]);

  const filtered = sales.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.receipt_number.toLowerCase().includes(q) ||
      (s.items_summary ?? "").toLowerCase().includes(q) ||
      s.payment_method.toLowerCase().includes(q)
    );
  });

  async function handleVoid(saleId: string) {
    const result = await voidSale(saleId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Sale voided successfully");
    const updated = await getRecentSales(20, modeCategories);
    cachedByModeRef.current[mode] = updated;
    setSales(updated);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
            Sales History
          </h1>
          <p className="text-muted-foreground text-sm">
            Complete record of {mode === "beauty" ? "beauty" : "pharmacy"}{" "}
            transactions
          </p>
          {isModeLoading && (
            <p className="text-xs text-muted-foreground mt-1">
              Refreshing data...
            </p>
          )}
        </div>
        <Badge variant="outline" className="border-primary text-primary">
          <Receipt className="h-3 w-3 mr-1" />
          {sales.length} sales
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search by receipt number, ${itemLabel}, or payment method...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-background/50 border-border focus:border-primary"
        />
      </div>

      {/* Sales Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            All Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {search
                ? "No sales matching your search"
                : "No sales recorded yet"}
            </p>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {filtered.map((sale) => (
                  <div
                    key={sale.id}
                    className="rounded-lg border border-border bg-background/40 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-mono text-xs">
                        {sale.receipt_number}
                      </span>
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
                    </div>
                    <p className="text-primary font-semibold text-sm">
                      {formatCurrency(sale.total_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {sale.payment_method} · {formatDateTime(sale.created_at)}
                    </p>
                    {(userRole === "admin" || userRole === "super_admin") && !sale.is_voided && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-8 px-2"
                        onClick={() => handleVoid(sale.id)}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Void Sale
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
                        Receipt #
                      </TableHead>
                      <TableHead className="text-muted-foreground hidden md:table-cell">
                        {mode === "beauty" ? "Products Sold" : "Items Sold"}
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Total
                      </TableHead>
                      <TableHead className="text-muted-foreground hidden sm:table-cell">
                        Payment
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Date/Time
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Status
                      </TableHead>
                      {(userRole === "admin" || userRole === "super_admin") && (
                        <TableHead className="text-muted-foreground text-right">
                          Action
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((sale) => (
                      <TableRow key={sale.id} className="border-border">
                        <TableCell className="text-white font-mono text-xs">
                          {sale.receipt_number}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-xs max-w-[250px] truncate hidden md:table-cell"
                          title={sale.items_summary ?? "-"}
                        >
                          {sale.items_summary || "-"}
                        </TableCell>
                        <TableCell className="text-primary font-medium">
                          {formatCurrency(sale.total_amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize hidden sm:table-cell">
                          {sale.payment_method}
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
                        {(userRole === "admin" || userRole === "super_admin") && (
                          <TableCell className="text-right">
                            {!sale.is_voided && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive h-7 px-2"
                                onClick={() => handleVoid(sale.id)}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Void
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
