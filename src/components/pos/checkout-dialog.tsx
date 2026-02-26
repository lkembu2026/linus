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
import { createSale } from "@/actions/sales";
import { formatCurrency, generateReceiptNumber } from "@/lib/utils";
import { CheckCircle, Loader2, Printer, Banknote } from "lucide-react";
import type { CartItem } from "@/types";
import { toast } from "sonner";

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  onSuccess: () => void;
}

export function CheckoutDialog({
  open,
  onClose,
  items,
  total,
  onSuccess,
}: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);
  const [receiptNo, setReceiptNo] = useState("");

  function handleConfirm() {
    startTransition(async () => {
      const result = await createSale(items, paymentMethod, total);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const receipt = generateReceiptNumber();
      setReceiptNo(receipt);
      setCompleted(true);
      toast.success("Sale completed successfully!");
    });
  }

  function handleClose() {
    if (completed) {
      onSuccess();
    }
    setCompleted(false);
    setReceiptNo("");
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
                </div>
              </div>
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
                onClick={() => {
                  // Future: print receipt
                  toast.info("Print feature coming soon");
                }}
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
