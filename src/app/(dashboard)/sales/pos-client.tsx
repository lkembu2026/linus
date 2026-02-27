"use client";

import { useState } from "react";
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
import { MedicineSearch } from "@/components/pos/medicine-search";
import { Cart } from "@/components/pos/cart";
import { CheckoutDialog } from "@/components/pos/checkout-dialog";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ShoppingCart, Clock, XCircle } from "lucide-react";
import { voidSale, getRecentSales } from "@/actions/sales";
import type { RecentSale } from "@/actions/sales";
import { toast } from "sonner";
import type { User } from "@/types/database";

interface POSClientProps {
  user: User & { branch?: { name: string } | null };
  initialRecentSales: RecentSale[];
}

export function POSClient({ user, initialRecentSales }: POSClientProps) {
  const cart = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [recentSales, setRecentSales] =
    useState<RecentSale[]>(initialRecentSales);

  async function handleSaleSuccess() {
    cart.clearCart();
    setCheckoutOpen(false);
    // Refresh recent sales
    const updated = await getRecentSales();
    setRecentSales(updated);
  }

  async function handleVoid(saleId: string) {
    const result = await voidSale(saleId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Sale voided successfully");
    const updated = await getRecentSales();
    setRecentSales(updated);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
            Point of Sale
          </h1>
          <p className="text-muted-foreground text-sm">
            {user.branch?.name ?? "All Branches"}
          </p>
        </div>
        <Badge variant="outline" className="border-primary text-primary">
          <ShoppingCart className="h-3 w-3 mr-1" />
          {cart.itemCount} items
        </Badge>
      </div>

      {/* POS grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Search + Recent Sales */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base text-white">
                Search Medicine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MedicineSearch
                onSelect={(medicine) =>
                  cart.addItem({
                    medicine_id: medicine.medicine_id,
                    name: medicine.name,
                    unit_price: medicine.unit_price,
                    quantity: 1,
                    max_quantity: medicine.max_quantity,
                  })
                }
              />
            </CardContent>
          </Card>

          {/* Recent sales */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Recent Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
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
                        <TableHead className="text-muted-foreground">
                          Items Sold
                        </TableHead>
                        <TableHead className="text-muted-foreground">
                          Total
                        </TableHead>
                        <TableHead className="text-muted-foreground">
                          Payment
                        </TableHead>
                        <TableHead className="text-muted-foreground">
                          Time
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
                      {recentSales.map((sale) => (
                        <TableRow key={sale.id} className="border-border">
                          <TableCell className="text-white font-mono text-xs">
                            {sale.receipt_number}
                          </TableCell>
                          <TableCell
                            className="text-muted-foreground text-xs max-w-[200px] truncate"
                            title={sale.items_summary ?? "-"}
                          >
                            {sale.items_summary || "-"}
                          </TableCell>
                          <TableCell className="text-primary font-medium">
                            {formatCurrency(sale.total_amount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground capitalize">
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
                          <TableCell className="text-right">
                            {!sale.is_voided && user.role === "admin" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleVoid(sale.id)}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Void
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Cart */}
        <div>
          <Cart
            items={cart.items}
            total={cart.total}
            onRemove={cart.removeItem}
            onUpdateQuantity={cart.updateQuantity}
            onCheckout={() => setCheckoutOpen(true)}
          />
        </div>
      </div>

      {/* Checkout dialog */}
      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cart.items}
        total={cart.total}
        onSuccess={handleSaleSuccess}
        cashierName={user.full_name ?? "Staff"}
        branchName={user.branch?.name ?? "Branch"}
        branchId={user.branch_id ?? ""}
      />
    </div>
  );
}
