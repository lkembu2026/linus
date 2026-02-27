"use client";

import { useState, useTransition, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSale } from "@/actions/sales";
import { formatCurrency, generateReceiptNumber } from "@/lib/utils";
import { saveOfflineSale } from "@/lib/offline/db";
import { Receipt } from "./receipt";
import {
  CheckCircle,
  Loader2,
  Printer,
  Banknote,
  Smartphone,
  WifiOff,
} from "lucide-react";
import type { CartItem } from "@/types";
import { toast } from "sonner";

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  onSuccess: () => void;
  cashierName?: string;
  branchName?: string;
  branchId?: string;
}

export function CheckoutDialog({
  open,
  onClose,
  items,
  total,
  onSuccess,
  cashierName = "Staff",
  branchName = "Branch",
  branchId = "",
}: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);
  const [receiptNo, setReceiptNo] = useState("");
  const [isOfflineSale, setIsOfflineSale] = useState(false);
  const [cashTendered, setCashTendered] = useState("");
  const [mpesaCode, setMpesaCode] = useState("");
  const receiptRef = useRef<HTMLDivElement>(null);

  const cashAmount = parseFloat(cashTendered) || 0;
  const change = cashAmount - total;

  function handleConfirm() {
    if (paymentMethod === "cash" && cashAmount < total) {
      toast.error("Cash tendered is less than total");
      return;
    }
    if (paymentMethod === "mpesa" && !mpesaCode.trim()) {
      toast.error("Please enter M-Pesa confirmation code");
      return;
    }

    startTransition(async () => {
      const isOnline = navigator.onLine;

      if (isOnline) {
        const result = await createSale(items, paymentMethod, total);
        if (result.error) {
          toast.error(result.error);
          return;
        }
      } else {
        // Save offline
        const offlineId = `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await saveOfflineSale({
          id: offlineId,
          items: items.map((i) => ({
            medicine_id: i.medicine_id,
            name: i.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
          total_amount: total,
          payment_method: paymentMethod,
          branch_id: branchId,
          created_at: new Date().toISOString(),
          synced: false,
        });
        setIsOfflineSale(true);
      }

      const receipt = generateReceiptNumber();
      setReceiptNo(receipt);
      setCompleted(true);
      toast.success(
        isOnline
          ? "Sale completed successfully!"
          : "Sale saved offline — will sync when back online",
      );
    });
  }

  function handlePrintReceipt() {
    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (!printWindow) {
      toast.error("Popup blocked — allow popups for printing");
      return;
    }
    const receiptHtml = receiptRef.current?.innerHTML ?? "";
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${receiptNo}</title>
          <style>
            body { margin: 0; padding: 0; font-family: 'Courier New', monospace; font-size: 12px; }
            .receipt { padding: 16px; max-width: 300px; margin: 0 auto; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .text-sm { font-size: 14px; }
            .flex { display: flex; justify-content: space-between; }
            .border-t { border-top: 1px dashed #999; margin: 8px 0; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .mt-4 { margin-top: 16px; }
            .mb-4 { margin-bottom: 16px; }
            .pl-4 { padding-left: 16px; }
            .text-xs { font-size: 10px; }
            .space-y-1 > * + * { margin-top: 4px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${receiptHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function handleClose() {
    if (completed) {
      onSuccess();
    }
    setCompleted(false);
    setReceiptNo("");
    setIsOfflineSale(false);
    setCashTendered("");
    setMpesaCode("");
    setPaymentMethod("cash");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        {!completed ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-sans)] text-white">
                Confirm Sale
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Items summary */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.medicine_id}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="text-white">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-medium text-white">Total</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Payment Method
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={paymentMethod === "cash" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("cash")}
                    className={
                      paymentMethod === "cash"
                        ? "bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    Cash
                  </Button>
                  <Button
                    variant={paymentMethod === "mpesa" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("mpesa")}
                    className={
                      paymentMethod === "mpesa"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "border-border text-muted-foreground"
                    }
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    M-Pesa
                  </Button>
                </div>
              </div>

              {/* Cash tendered + Change */}
              {paymentMethod === "cash" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground text-sm">
                      Cash Tendered (KES)
                    </Label>
                    <Input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="bg-background border-border text-white mt-1"
                      placeholder={total.toString()}
                      min={0}
                    />
                  </div>
                  {cashAmount > 0 && (
                    <div className="flex justify-between items-center p-2 rounded-lg bg-background/50 border border-border">
                      <span className="text-sm text-muted-foreground">
                        Change
                      </span>
                      <span
                        className={`text-lg font-bold ${change >= 0 ? "text-green-400" : "text-destructive"}`}
                      >
                        {formatCurrency(Math.max(0, change))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* M-Pesa confirmation code */}
              {paymentMethod === "mpesa" && (
                <div>
                  <Label className="text-muted-foreground text-sm">
                    M-Pesa Confirmation Code
                  </Label>
                  <Input
                    value={mpesaCode}
                    onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                    className="bg-background border-border text-white mt-1 font-mono"
                    placeholder="e.g. SBK7XYZ123"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the M-Pesa transaction code received by the customer
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={handleClose}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isPending}
                className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Complete Sale"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="py-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Sale Complete!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Receipt:{" "}
                <span className="text-primary font-mono">{receiptNo}</span>
              </p>
              <p className="text-2xl font-bold text-primary mt-2 glow-text">
                {formatCurrency(total)}
              </p>
              <Badge className="mt-2 bg-primary/10 text-primary border-primary/20">
                {paymentMethod.toUpperCase()}
              </Badge>
              {isOfflineSale && (
                <Badge className="mt-2 ml-2 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                  <WifiOff className="h-3 w-3 mr-1" /> Offline
                </Badge>
              )}
              {paymentMethod === "cash" && cashAmount > 0 && change > 0 && (
                <p className="text-sm text-green-400 mt-2">
                  Change: {formatCurrency(change)}
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-border text-muted-foreground"
              >
                New Sale
              </Button>
              <Button
                variant="ghost"
                className="text-primary"
                onClick={handlePrintReceipt}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
            </div>

            {/* Hidden receipt for printing */}
            <div className="hidden">
              <div ref={receiptRef}>
                <Receipt
                  receiptNo={receiptNo}
                  items={items}
                  total={total}
                  paymentMethod={paymentMethod}
                  cashierName={cashierName}
                  branchName={branchName}
                  date={new Date()}
                  cashTendered={
                    paymentMethod === "cash" ? cashAmount : undefined
                  }
                  change={
                    paymentMethod === "cash" && change > 0 ? change : undefined
                  }
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
