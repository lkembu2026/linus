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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustStock } from "@/actions/inventory";
import { Loader2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import type { Medicine } from "@/types/database";

interface StockAdjustDialogProps {
  open: boolean;
  onClose: () => void;
  medicine: Medicine | null;
}

export function StockAdjustDialog({
  open,
  onClose,
  medicine,
}: StockAdjustDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [adjustment, setAdjustment] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [reason, setReason] = useState("");

  if (!medicine) return null;

  function handleSubmit() {
    const qty = parseInt(adjustment);
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    const adj = direction === "add" ? qty : -qty;

    startTransition(async () => {
      const result = await adjustStock(medicine!.id, adj, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock adjusted successfully");
      setAdjustment("");
      setReason("");
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white font-[family-name:var(--font-sans)]">
            Adjust Stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm text-white font-medium">{medicine.name}</p>
            <p className="text-xs text-muted-foreground">
              Current stock: {medicine.quantity_in_stock}
            </p>
          </div>

          {/* Direction */}
          <div className="flex gap-2">
            <Button
              variant={direction === "add" ? "default" : "outline"}
              size="sm"
              onClick={() => setDirection("add")}
              className={
                direction === "add"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "border-border text-muted-foreground"
              }
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Stock
            </Button>
            <Button
              variant={direction === "remove" ? "default" : "outline"}
              size="sm"
              onClick={() => setDirection("remove")}
              className={
                direction === "remove"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : "border-border text-muted-foreground"
              }
            >
              <Minus className="h-3 w-3 mr-1" />
              Remove Stock
            </Button>
          </div>

          <div>
            <Label className="text-muted-foreground">Quantity</Label>
            <Input
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="bg-background border-border text-white mt-1"
              placeholder="Enter quantity"
              min={1}
            />
          </div>

          <div>
            <Label className="text-muted-foreground">Reason *</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-background border-border text-white mt-1"
              placeholder="e.g. New shipment, Damaged, Expired"
            />
          </div>

          {adjustment && parseInt(adjustment) > 0 && (
            <p className="text-xs text-muted-foreground">
              New stock will be:{" "}
              <span className="text-primary font-medium">
                {direction === "add"
                  ? medicine.quantity_in_stock + parseInt(adjustment)
                  : medicine.quantity_in_stock - parseInt(adjustment)}
              </span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adjusting...
              </>
            ) : (
              "Confirm Adjustment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
