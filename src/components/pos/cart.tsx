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
  onUpdateQuantity: (medicineId: string, quantity: number) => void;
  onRemove: (medicineId: string) => void;
  onCheckout: () => void;
}

export function Cart({
  items,
  total,
  onUpdateQuantity,
  onRemove,
  onCheckout,
}: CartProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
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
          items.map((item) => (
            <div
              key={item.medicine_id}
              className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border"
            >
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
                <p className="text-sm font-semibold text-primary">
                  {formatCurrency(item.unit_price * item.quantity)}
                </p>
                <button
                  onClick={() => onRemove(item.medicine_id)}
                  className="text-xs text-destructive hover:underline mt-0.5"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer: Total + Checkout */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-bold text-primary glow-text">
            {formatCurrency(total)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Add multiple different items to this cart, then confirm once to print a
          single combined receipt.
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
