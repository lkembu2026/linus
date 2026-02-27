"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MedicineSearch } from "@/components/pos/medicine-search";
import { Cart } from "@/components/pos/cart";
import { CheckoutDialog } from "@/components/pos/checkout-dialog";
import { useCart } from "@/hooks/use-cart";
import { useHardwareScanner } from "@/hooks/use-hardware-scanner";
import { searchMedicines } from "@/actions/sales";
import {
  ShoppingCart,
  ScanBarcode,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/types/database";

interface POSClientProps {
  user: User & { branch?: { name: string } | null };
}

export function POSClient({ user }: POSClientProps) {
  const cart = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{
    type: "success" | "error" | "multi";
    message: string;
  } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showFeedback(type: "success" | "error" | "multi", message: string) {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setScanFeedback({ type, message });
    feedbackTimerRef.current = setTimeout(() => setScanFeedback(null), 3000);
  }

  const handleHardwareScan = useCallback(
    async (barcode: string) => {
      const results = await searchMedicines(barcode);
      if (results.length === 0) {
        showFeedback("error", `No medicine found for: ${barcode}`);
        toast.error(`Barcode not found: ${barcode}`);
        return;
      }
      if (results.length === 1) {
        cart.addItem({
          medicine_id: results[0].medicine_id,
          name: results[0].name,
          unit_price: results[0].unit_price,
          quantity: 1,
          max_quantity: results[0].max_quantity,
          dispensing_unit: (results[0] as any).dispensing_unit ?? null,
        });
        showFeedback("success", `Added: ${results[0].name}`);
        toast.success(`Added ${results[0].name} to cart`);
        return;
      }
      // Multiple results — let the search field handle it
      showFeedback(
        "multi",
        `${results.length} matches for "${barcode}" — select below`,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart],
  );

  useHardwareScanner(handleHardwareScan, !checkoutOpen);

  function handleSaleSuccess() {
    cart.clearCart();
    setCheckoutOpen(false);
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
        <div className="flex items-center gap-2">
          {/* Scanner feedback badge */}
          {scanFeedback ? (
            <Badge
              variant="outline"
              className={
                scanFeedback.type === "success"
                  ? "border-green-500 text-green-400 animate-pulse"
                  : scanFeedback.type === "error"
                    ? "border-destructive text-destructive"
                    : "border-amber-500 text-amber-400"
              }
            >
              {scanFeedback.type === "success" ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {scanFeedback.message}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-primary/40 text-primary/70"
            >
              <ScanBarcode className="h-3 w-3 mr-1" />
              Scanner ready
            </Badge>
          )}
          <Badge variant="outline" className="border-primary text-primary">
            <ShoppingCart className="h-3 w-3 mr-1" />
            {cart.itemCount} items
          </Badge>
        </div>
      </div>

      {/* POS grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Search + scanner tip */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center justify-between">
                <span>Search Medicine</span>
                <span className="text-xs text-primary/70 font-normal flex items-center gap-1">
                  <ScanBarcode className="h-3.5 w-3.5" />
                  Hardware scanner supported
                </span>
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
                    dispensing_unit: (medicine as any).dispensing_unit ?? null,
                  })
                }
              />
            </CardContent>
          </Card>

          {/* Scanner usage tip */}
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <ScanBarcode className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-primary font-medium">
                Hardware scanner ready.
              </span>{" "}
              Plug in your USB or Bluetooth barcode scanner and scan any product
              barcode — it will be added to the cart instantly without clicking
              anything. Works best when the search box or page is in focus.
            </p>
          </div>
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
