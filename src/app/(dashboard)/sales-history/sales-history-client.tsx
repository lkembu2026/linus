"use client";

import { useState } from "react";
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
import type { RecentSale } from "@/actions/sales";
import { toast } from "sonner";

interface SalesHistoryClientProps {
  sales: RecentSale[];
  userRole: string;
}

export function SalesHistoryClient({
  sales: initialSales,
  userRole,
}: SalesHistoryClientProps) {
  const [sales, setSales] = useState<RecentSale[]>(initialSales);
  const [search, setSearch] = useState("");

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
    const updated = await getRecentSales();
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
            Complete record of all transactions
          </p>
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
          placeholder="Search by receipt number, items, or payment method..."
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
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">
                      Receipt #
                    </TableHead>
                    <TableHead className="text-muted-foreground hidden md:table-cell">
                      Items Sold
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
                    {userRole === "admin" && (
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
    </div>
  );
}
