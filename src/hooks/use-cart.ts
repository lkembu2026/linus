"use client";

import { useState, useCallback } from "react";
import type { CartItem } from "@/types";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.medicine_id === item.medicine_id);
        if (existing) {
          // Don't exceed available stock
          const newQty = Math.min(
            existing.quantity + (item.quantity || 1),
            item.max_quantity,
          );
          return prev.map((i) =>
            i.medicine_id === item.medicine_id ? { ...i, quantity: newQty } : i,
          );
        }
        return [
          ...prev,
          { ...item, quantity: item.quantity || 1, discount_percent: 0 },
        ];
      });
    },
    [],
  );

  const removeItem = useCallback((medicineId: string) => {
    setItems((prev) => prev.filter((i) => i.medicine_id !== medicineId));
  }, []);

  const updateQuantity = useCallback((medicineId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.medicine_id === medicineId) {
          const newQty = Math.max(1, Math.min(quantity, i.max_quantity));
          return { ...i, quantity: newQty };
        }
        return i;
      }),
    );
  }, []);

  const updateDiscount = useCallback((medicineId: string, percent: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.medicine_id === medicineId
          ? {
              ...i,
              discount_percent: Math.max(0, Math.min(100, percent)),
              discount_amount: 0,
            }
          : i,
      ),
    );
  }, []);

  const updateDiscountAmount = useCallback(
    (medicineId: string, amount: number) => {
      setItems((prev) =>
        prev.map((i) => {
          if (i.medicine_id !== medicineId) return i;
          const lineTotal = i.unit_price * i.quantity;
          const clamped = Math.max(0, Math.min(lineTotal, amount));
          return { ...i, discount_amount: clamped, discount_percent: 0 };
        }),
      );
    },
    [],
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const subtotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  const totalDiscount = items.reduce((sum, item) => {
    const lineTotal = item.unit_price * item.quantity;
    if ((item.discount_amount ?? 0) > 0) {
      return sum + Math.min(item.discount_amount!, lineTotal);
    }
    const disc = item.discount_percent ?? 0;
    return sum + lineTotal * (disc / 100);
  }, 0);

  const total = subtotal - totalDiscount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    updateDiscount,
    updateDiscountAmount,
    clearCart,
    subtotal,
    totalDiscount,
    total,
    itemCount,
  };
}
