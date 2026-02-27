"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Clock, XCircle, ArrowRight } from "lucide-react";
import { voidSale, getRecentSales } from "@/actions/sales";
import type { RecentSale } from "@/actions/sales";
import { toast } from "sonner";
import { useState } from "react";
import Link from "next/link";

interface RecentSalesProps {
  sales: RecentSale[];
  userRole: string;
}

export function RecentSales({
  sales: initialSales,
  userRole,
}: RecentSalesProps) {
  const [sales, setSales] = useState<RecentSale[]>(initialSales);

  async function handleVoid(saleId: string) {
    const result = await voidSale(saleId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Sale voided successfully");
    const updated = await getRecentSales();
    setSales(updated);
  }

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Recent Sales
        </CardTitle>
        <Link href="/sales-history">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80 text-xs"
          >
            View All <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">
            No sales yet today
          </p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">
                    Receipt #
                  </TableHead>
                  <TableHead className="text-muted-foreground hidden md:table-cell">
                    Items
                  </TableHead>
                  <TableHead className="text-muted-foreground">Total</TableHead>
                  <TableHead className="text-muted-foreground hidden sm:table-cell">
                    Payment
                  </TableHead>
                  <TableHead className="text-muted-foreground">Time</TableHead>
                  <TableHead className="text-muted-foreground">
                    Status
                  </TableHead>
                  {userRole === "admin" && (
                    <TableHead className="text-muted-foreground text-right">
                      Action
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.slice(0, 8).map((sale) => (
                  <TableRow key={sale.id} className="border-border">
                    <TableCell className="text-white font-mono text-xs">
                      {sale.receipt_number}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground text-xs max-w-[180px] truncate hidden md:table-cell"
                      title={sale.items_summary ?? "-"}
                    >
                      {sale.items_summary || "-"}
                    </TableCell>
                    <TableCell className="text-primary font-medium text-sm">
                      {formatCurrency(sale.total_amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize text-sm hidden sm:table-cell">
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
                        {sale.is_voided ? "Voided" : "OK"}
                      </Badge>
                    </TableCell>
                    {userRole === "admin" && (
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
        )}
      </CardContent>
    </Card>
  );
}
