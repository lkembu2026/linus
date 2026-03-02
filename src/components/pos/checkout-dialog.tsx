"use client";

import { useState, useTransition } from "react";
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
import { createCredit } from "@/actions/credits";
import { formatCurrency, generateReceiptNumber } from "@/lib/utils";
import { saveOfflineSale } from "@/lib/offline/db";
import { isActuallyOnline } from "@/lib/offline/connectivity";
import {
  CheckCircle,
  Loader2,
  Printer,
  Banknote,
  Smartphone,
  WifiOff,
  CreditCard,
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
  const [receiptHtml, setReceiptHtml] = useState("");
  const [isOfflineSale, setIsOfflineSale] = useState(false);
  const [cashTendered, setCashTendered] = useState("");
  const [mpesaCode, setMpesaCode] = useState("");
  // Credit fields
  const [creditName, setCreditName] = useState("");
  const [creditPhone, setCreditPhone] = useState("");
  const [creditNotes, setCreditNotes] = useState("");

  const cashAmount = parseFloat(cashTendered) || 0;
  const change = cashAmount - total;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  function handleConfirm() {
    if (paymentMethod === "cash" && cashAmount < total) {
      toast.error("Cash tendered is less than total");
      return;
    }
    if (paymentMethod === "mpesa" && !mpesaCode.trim()) {
      toast.error("Please enter M-Pesa confirmation code");
      return;
    }
    if (paymentMethod === "credit" && !creditName.trim()) {
      toast.error("Customer name is required for credit sales");
      return;
    }

    startTransition(async () => {
      // Use a real connectivity probe — navigator.onLine lies when on WiFi
      // with no data bundles (returns true even though internet is unavailable)
      const online = await isActuallyOnline();

      async function saveOffline() {
        const offlineId = `OFF-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;
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
        const receipt = generateReceiptNumber();
        setReceiptNo(receipt);
        setIsOfflineSale(true);
      }

      if (online) {
        try {
          const result = await createSale(items, paymentMethod, total);
          if (result.error) {
            // Business-logic error (e.g. insufficient stock) — do NOT save offline
            toast.error(result.error);
            return;
          }
          if (result.receiptNumber) setReceiptNo(result.receiptNumber);
          if (result.receiptHtml) setReceiptHtml(result.receiptHtml);

          // If credit sale, create credit record
          if (paymentMethod === "credit" && result.saleId) {
            const medicineDetails = items
              .map((i) => `${i.name} ×${i.quantity}`)
              .join(", ");
            await createCredit({
              saleId: result.saleId,
              receiptNo: result.receiptNumber ?? "",
              customerName: creditName.trim(),
              customerPhone: creditPhone.trim() || undefined,
              amount: total,
              medicineDetails,
              notes: creditNotes.trim() || undefined,
            });
          }
        } catch {
          // Network request failed mid-flight (connection dropped) — save offline
          console.warn("createSale network failure — saving offline");
          await saveOffline();
        }
      } else {
        await saveOffline();
      }

      setCompleted(true);
      toast.success(
        paymentMethod === "credit"
          ? `Credit recorded for ${creditName}`
          : isOfflineSale || !online
            ? "Sale saved offline — will sync when back online"
            : `Sale completed successfully — 1 receipt for ${items.length} item type${items.length === 1 ? "" : "s"}`,
      );
    });
  }

  function handlePrintReceipt() {
    const printWindow = window.open("", "_blank", "width=420,height=750");
    if (!printWindow) {
      toast.error("Popup blocked — please allow popups for printing");
      return;
    }

    // Use the server-generated premium receipt HTML if available
    if (receiptHtml) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      // Auto-print after a short delay to let styles render
      setTimeout(() => {
        printWindow.print();
      }, 300);
      return;
    }

    // Fallback: generate locally if no server HTML
    const now = new Date();
    const dateStr = now.toLocaleString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const itemRows = items
      .map(
        (item) =>
          `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #1a1a2e;color:#e0e0e0;font-size:13px;">${item.name}</td>
            <td style="padding:8px 0;border-bottom:1px solid #1a1a2e;text-align:center;color:#a0a0b0;font-size:13px;">${item.quantity}</td>
            <td style="padding:8px 0;border-bottom:1px solid #1a1a2e;text-align:right;color:#a0a0b0;font-size:13px;">KES ${item.unit_price.toLocaleString()}</td>
            <td style="padding:8px 0;border-bottom:1px solid #1a1a2e;text-align:right;color:#e0e0e0;font-weight:600;font-size:13px;">KES ${(item.unit_price * item.quantity).toLocaleString()}</td>
          </tr>`,
      )
      .join("");

    const cashSection =
      paymentMethod === "cash" && cashAmount > 0
        ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#a0a0b0;font-size:13px;">
            <span>Cash Tendered</span><span style="color:#e0e0e0;">KES ${cashAmount.toLocaleString()}</span>
          </div>
          ${change > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#4ade80;font-size:13px;font-weight:600;"><span>Change</span><span>KES ${change.toLocaleString()}</span></div>` : ""}`
        : "";

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Receipt ${receiptNo}</title>
<style>@media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; } }</style>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:360px;margin:0 auto;padding:24px 20px;background:#0a0a0f;">
    <div style="text-align:center;padding-bottom:20px;">
      <div style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#00ffe0 0%,#00b8a9 100%);border-radius:8px;margin-bottom:12px;">
        <div style="font-size:18px;font-weight:800;color:#0a0a0f;letter-spacing:1px;">LK PHARMACARE</div>
      </div>
      <div style="color:#a0a0b0;font-size:12px;margin-top:8px;">${branchName}</div>
      <div style="color:#666;font-size:11px;margin-top:4px;">${dateStr}</div>
    </div>
    <div style="text-align:center;margin:16px 0;">
      <div style="display:inline-block;padding:6px 16px;border:1px solid #00ffe0;border-radius:20px;color:#00ffe0;font-size:12px;font-weight:600;">${receiptNo}</div>
    </div>
    <div style="height:1px;background:linear-gradient(to right,transparent,#1a1a2e 20%,#00ffe0 50%,#1a1a2e 80%,transparent);margin:16px 0;"></div>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <thead><tr>
        <th style="padding:8px 0;text-align:left;color:#00ffe0;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1a1a2e;">Item</th>
        <th style="padding:8px 0;text-align:center;color:#00ffe0;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1a1a2e;">Qty</th>
        <th style="padding:8px 0;text-align:right;color:#00ffe0;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1a1a2e;">Price</th>
        <th style="padding:8px 0;text-align:right;color:#00ffe0;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1a1a2e;">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="height:2px;background:linear-gradient(to right,transparent,#00ffe0,transparent);margin:16px 0;"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:linear-gradient(135deg,#0d1117 0%,#111827 100%);border:1px solid #00ffe0;border-radius:10px;margin:8px 0;">
      <span style="color:#00ffe0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Total</span>
      <span style="color:#00ffe0;font-size:22px;font-weight:800;">KES ${total.toLocaleString()}</span>
    </div>
    <div style="margin:16px 0;padding:12px 16px;background:#111827;border-radius:8px;border:1px solid #1a1a2e;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="color:#a0a0b0;font-size:12px;text-transform:uppercase;">Payment</span>
        <span style="padding:2px 12px;background:${paymentMethod === "mpesa" ? "#065F46" : "#1e3a5f"};color:${paymentMethod === "mpesa" ? "#6ee7b7" : "#93c5fd"};border-radius:12px;font-size:11px;font-weight:600;">${paymentMethod.toUpperCase()}</span>
      </div>
      ${cashSection}
    </div>
    <div style="height:1px;background:linear-gradient(to right,transparent,#1a1a2e 20%,#1a1a2e 80%,transparent);margin:16px 0;"></div>
    <div style="text-align:center;padding:12px 0;">
      <div style="color:#a0a0b0;font-size:11px;">Served by <span style="color:#e0e0e0;font-weight:600;">${cashierName}</span></div>
      <div style="margin:16px 0;">
        <div style="color:#00ffe0;font-size:13px;font-weight:600;">Thank you for your purchase!</div>
        <div style="color:#555;font-size:10px;margin-top:4px;">Get well soon — we care about your health</div>
      </div>
      <div style="color:#333;font-size:9px;">&copy; ${new Date().getFullYear()} LK PharmaCare</div>
    </div>
  </div>
</body></html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  function handleClose() {
    if (completed) {
      onSuccess();
    }
    setCompleted(false);
    setReceiptNo("");
    setReceiptHtml("");
    setIsOfflineSale(false);
    setCashTendered("");
    setMpesaCode("");
    setCreditName("");
    setCreditPhone("");
    setCreditNotes("");
    setPaymentMethod("cash");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        {!completed ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-sans)] text-white">
                Confirm Sale
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-xs text-muted-foreground">
                This checkout will generate one receipt for all selected items (
                {items.length} item type{items.length === 1 ? "" : "s"},{" "}
                {totalUnits} total unit{totalUnits === 1 ? "" : "s"}).
              </p>

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
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant={paymentMethod === "cash" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("cash")}
                    className={`w-full sm:w-auto ${
                      paymentMethod === "cash"
                        ? "bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    Cash
                  </Button>
                  <Button
                    variant={paymentMethod === "mpesa" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("mpesa")}
                    className={`w-full sm:w-auto ${
                      paymentMethod === "mpesa"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    M-Pesa
                  </Button>
                  <Button
                    variant={paymentMethod === "credit" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("credit")}
                    className={`w-full sm:w-auto ${
                      paymentMethod === "credit"
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Credit
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

              {/* Credit customer details */}
              {paymentMethod === "credit" && (
                <div className="space-y-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <p className="text-xs text-amber-400 font-medium">
                    Customer will pay later — record their details below
                  </p>
                  <div>
                    <Label className="text-muted-foreground text-sm">
                      Customer Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={creditName}
                      onChange={(e) => setCreditName(e.target.value)}
                      className="bg-background border-border text-white mt-1"
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">
                      Phone Number
                    </Label>
                    <Input
                      value={creditPhone}
                      onChange={(e) => setCreditPhone(e.target.value)}
                      className="bg-background border-border text-white mt-1"
                      placeholder="e.g. 0712 345 678"
                      type="tel"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">
                      Notes (optional)
                    </Label>
                    <Input
                      value={creditNotes}
                      onChange={(e) => setCreditNotes(e.target.value)}
                      className="bg-background border-border text-white mt-1"
                      placeholder="e.g. Regular customer, pay Friday"
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="ghost"
                onClick={handleClose}
                className="text-muted-foreground w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isPending}
                className="bg-primary text-primary-foreground hover:bg-[#00B8A9] w-full sm:w-auto"
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
                {paymentMethod === "credit"
                  ? "CREDIT"
                  : paymentMethod.toUpperCase()}
              </Badge>
              {paymentMethod === "credit" && (
                <div className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-left">
                  <p className="text-xs text-amber-400 font-semibold mb-1">
                    Credit Recorded
                  </p>
                  <p className="text-sm text-white">{creditName}</p>
                  {creditPhone && (
                    <p className="text-xs text-muted-foreground">
                      {creditPhone}
                    </p>
                  )}
                  <p className="text-sm font-bold text-amber-400 mt-1">
                    Owes: {formatCurrency(total)}
                  </p>
                </div>
              )}
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
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-border text-muted-foreground w-full sm:w-auto"
              >
                New Sale
              </Button>
              <Button
                variant="ghost"
                className="text-primary w-full sm:w-auto"
                onClick={handlePrintReceipt}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
