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
        return [...prev, { ...item, quantity: item.quantity || 1 }];
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

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    itemCount,
  };
}
