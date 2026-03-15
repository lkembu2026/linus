"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getDiscountedSales } from "@/actions/discounts";
import type { DiscountedSaleItem } from "@/actions/discounts";
import { Percent, ChevronLeft, ChevronRight, Tag } from "lucide-react";

interface DiscountsClientProps {
  initialItems: DiscountedSaleItem[];
  initialTotal: number;
}

export function DiscountsClient({
  initialItems,
  initialTotal,
}: DiscountsClientProps) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const limit = 50;
  const totalPages = Math.ceil(total / limit);

  const totalDiscountGiven = items.reduce(
    (sum, i) => sum + i.discount_amount,
    0,
  );
  const totalFinalRevenue = items.reduce((sum, i) => sum + i.final_total, 0);

  function loadPage(p: number) {
    startTransition(async () => {
      const result = await getDiscountedSales({ page: p, limit });
      setItems(result.items);
      setTotal(result.total);
      setPage(p);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
          Discount History
        </h1>
        <p className="text-muted-foreground text-sm">
          Track all discounted sales across your branch
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Discounted Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{total}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Percent className="h-3 w-3" />
              Total Discount Given
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-400">
              {formatCurrency(totalDiscountGiven)}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              Revenue After Discounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(totalFinalRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="glass-card">
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Percent className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No discounted sales yet</p>
              <p className="text-xs mt-1">
                Discounts applied during POS checkout will appear here
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-primary">Date</TableHead>
                      <TableHead className="text-primary">Receipt</TableHead>
                      <TableHead className="text-primary">Medicine</TableHead>
                      <TableHead className="text-primary text-center">
                        Qty
                      </TableHead>
                      <TableHead className="text-primary text-right">
                        Unit Price
                      </TableHead>
                      <TableHead className="text-primary text-center">
                        Discount
                      </TableHead>
                      <TableHead className="text-primary text-right">
                        Saved
                      </TableHead>
                      <TableHead className="text-primary text-right">
                        Final
                      </TableHead>
                      <TableHead className="text-primary">Cashier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        className="border-border hover:bg-primary/5"
                      >
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDateTime(item.sale_date)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-primary/70">
                            {item.receipt_number}
                          </span>
                        </TableCell>
                        <TableCell className="text-white text-sm">
                          {item.medicine_name}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 text-amber-400"
                          >
                            {item.discount_percent}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-amber-400 text-sm">
                          {formatCurrency(item.discount_amount)}
                        </TableCell>
                        <TableCell className="text-right text-white font-medium text-sm">
                          {formatCurrency(item.final_total)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {item.cashier_name}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({total} items)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || isPending}
                      onClick={() => loadPage(page - 1)}
                      className="border-border text-muted-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages || isPending}
                      onClick={() => loadPage(page + 1)}
                      className="border-border text-muted-foreground"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
