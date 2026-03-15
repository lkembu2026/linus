"use client";

import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/types";

interface CartProps {
  items: CartItem[];
  total: number;
  subtotal: number;
  totalDiscount: number;
  onUpdateQuantity: (medicineId: string, quantity: number) => void;
  onUpdateDiscount: (medicineId: string, percent: number) => void;
  onUpdateDiscountAmount: (medicineId: string, amount: number) => void;
  onRemove: (medicineId: string) => void;
  onCheckout: () => void;
}

export function Cart({
  items,
  total,
  subtotal,
  totalDiscount,
  onUpdateQuantity,
  onUpdateDiscount,
  onUpdateDiscountAmount,
  onRemove,
  onCheckout,
}: CartProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [discountEditId, setDiscountEditId] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [discountMode, setDiscountMode] = useState<Record<string, "%" | "KES">>({});
  return (
    <div className="glass-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="text-base font-semibold font-[family-name:var(--font-sans)] text-white">
          Sale Cart
        </h3>
        <p className="text-xs text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mb-3">
              <span className="text-2xl">🛒</span>
            </div>
            <p className="text-sm text-muted-foreground">Cart is empty</p>
            <p className="text-xs text-muted-foreground mt-1">
              Search & add medicines above
            </p>
          </div>
        ) : (
          items.map((item) => {
            const disc = item.discount_percent ?? 0;
            const discAmt = item.discount_amount ?? 0;
            const lineTotal = item.unit_price * item.quantity;
            const effectiveDiscount = discAmt > 0 ? Math.min(discAmt, lineTotal) : lineTotal * (disc / 100);
            const discountedTotal = lineTotal - effectiveDiscount;
            const mode = discountMode[item.medicine_id] ?? (discAmt > 0 ? "KES" : "%");
            return (
              <div
                key={item.medicine_id}
                className="p-3 rounded-lg bg-background/50 border border-border space-y-2"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.unit_price)} ×{" "}
                      <span className="text-white font-medium">
                        {item.quantity}
                      </span>
                      {item.dispensing_unit ? (
                        <span className="text-primary/70">
                          {" "}
                          {item.dispensing_unit}
                          {item.quantity > 1 &&
                          item.dispensing_unit !== "ml" &&
                          item.dispensing_unit !== "g"
                            ? "s"
                            : ""}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-white"
                      onClick={() =>
                        onUpdateQuantity(item.medicine_id, item.quantity - 1)
                      }
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    {editingId === item.medicine_id ? (
                      <Input
                        type="number"
                        value={editValue}
                        autoFocus
                        className="w-14 h-7 text-center text-sm bg-background border-primary text-white p-1"
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                          const n = parseInt(editValue);
                          if (n > 0) onUpdateQuantity(item.medicine_id, n);
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const n = parseInt(editValue);
                            if (n > 0) onUpdateQuantity(item.medicine_id, n);
                            setEditingId(null);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      <button
                        className="w-8 text-center text-sm font-medium text-white hover:text-primary transition-colors cursor-pointer"
                        title="Click to type quantity"
                        onClick={() => {
                          setEditingId(item.medicine_id);
                          setEditValue(item.quantity.toString());
                        }}
                      >
                        {item.quantity}
                      </button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-white"
                      onClick={() =>
                        onUpdateQuantity(item.medicine_id, item.quantity + 1)
                      }
                      disabled={item.quantity >= item.max_quantity}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Subtotal + Remove */}
                  <div className="text-right">
                    {effectiveDiscount > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground line-through">
                          {formatCurrency(lineTotal)}
                        </p>
                        <p className="text-sm font-semibold text-primary">
                          {formatCurrency(discountedTotal)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-primary">
                        {formatCurrency(lineTotal)}
                      </p>
                    )}
                    <button
                      onClick={() => onRemove(item.medicine_id)}
                      className="text-xs text-destructive hover:underline mt-0.5"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Discount row */}
                <div className="flex items-center gap-2">
                  {/* Mode toggle */}
                  <button
                    onClick={() => {
                      const newMode = mode === "%" ? "KES" : "%";
                      setDiscountMode((prev) => ({ ...prev, [item.medicine_id]: newMode }));
                      // Clear current discount when switching modes
                      if (newMode === "%") onUpdateDiscountAmount(item.medicine_id, 0);
                      else onUpdateDiscount(item.medicine_id, 0);
                      setDiscountEditId(null);
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:border-primary/50 hover:text-primary cursor-pointer transition-colors shrink-0"
                    title={`Switch to ${mode === "%" ? "KES amount" : "percentage"} discount`}
                  >
                    {mode === "%" ? "%" : "KES"}
                  </button>
                  {discountEditId === item.medicine_id ? (
                    <Input
                      type="number"
                      value={discountValue}
                      autoFocus
                      min={0}
                      max={mode === "%" ? 100 : lineTotal}
                      className="w-20 h-6 text-center text-xs bg-background border-primary text-white p-1"
                      onChange={(e) => setDiscountValue(e.target.value)}
                      onBlur={() => {
                        const n = parseFloat(discountValue);
                        if (!isNaN(n)) {
                          if (mode === "%") onUpdateDiscount(item.medicine_id, n);
                          else onUpdateDiscountAmount(item.medicine_id, n);
                        }
                        setDiscountEditId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const n = parseFloat(discountValue);
                          if (!isNaN(n)) {
                            if (mode === "%") onUpdateDiscount(item.medicine_id, n);
                            else onUpdateDiscountAmount(item.medicine_id, n);
                          }
                          setDiscountEditId(null);
                        }
                        if (e.key === "Escape") setDiscountEditId(null);
                      }}
                    />
                  ) : (
                    <button
                      className="text-xs text-muted-foreground hover:text-primary cursor-pointer"
                      onClick={() => {
                        setDiscountEditId(item.medicine_id);
                        setDiscountValue(
                          mode === "%" ? (disc).toString() : (discAmt).toString(),
                        );
                      }}
                    >
                      {effectiveDiscount > 0 ? (
                        <span className="text-amber-400 font-medium">
                          {discAmt > 0 ? `KES ${discAmt.toLocaleString()} off` : `${disc}% off`}
                        </span>
                      ) : (
                        "Add discount"
                      )}
                    </button>
                  )}
                  <div className="flex gap-1 ml-auto">
                    {mode === "%" ? (
                      [5, 10, 15, 20].map((p) => (
                        <button
                          key={p}
                          onClick={() =>
                            onUpdateDiscount(item.medicine_id, disc === p ? 0 : p)
                          }
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                            disc === p
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary/70"
                          }`}
                        >
                          {p}%
                        </button>
                      ))
                    ) : (
                      [50, 100, 200, 500].map((a) => (
                        <button
                          key={a}
                          onClick={() =>
                            onUpdateDiscountAmount(item.medicine_id, discAmt === a ? 0 : a)
                          }
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                            discAmt === a
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary/70"
                          }`}
                        >
                          {a}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: Total + Checkout */}
      <div className="p-4 border-t border-border space-y-3">
        {totalDiscount > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Subtotal</span>
              <span className="text-sm text-muted-foreground">
                {formatCurrency(subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-400">Discount</span>
              <span className="text-sm text-amber-400">
                -{formatCurrency(totalDiscount)}
              </span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-bold text-primary glow-text">
            {formatCurrency(total)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Add multiple different items to this cart, then confirm once to print
          a single combined receipt.
        </p>
        <Button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full h-12 bg-primary text-primary-foreground hover:bg-[#00B8A9] font-semibold uppercase tracking-wider"
          style={{
            boxShadow:
              items.length > 0 ? "0 4px 15px rgba(0, 255, 224, 0.3)" : "none",
          }}
        >
          Confirm Sale
        </Button>
      </div>
    </div>
  );
}
