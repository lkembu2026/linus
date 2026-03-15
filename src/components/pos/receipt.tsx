"use client";

import { formatCurrency, formatDateTime } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import type { CartItem } from "@/types";

interface ReceiptProps {
  receiptNo: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  cashierName: string;
  branchName: string;
  date: Date;
  cashTendered?: number;
  change?: number;
}

export function Receipt({
  receiptNo,
  items,
  total,
  paymentMethod,
  cashierName,
  branchName,
  date,
  cashTendered,
  change,
}: ReceiptProps) {
  return (
    <div className="bg-white text-black p-6 max-w-xs mx-auto font-mono text-xs leading-relaxed">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-sm font-bold">{APP_NAME}</h2>
        <p>{branchName}</p>
        <p className="text-[10px] mt-1">{formatDateTime(date.toISOString())}</p>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* Receipt number */}
      <p className="text-center font-bold">{receiptNo}</p>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => {
          const disc = item.discount_percent ?? 0;
          const discAmt = item.discount_amount ?? 0;
          const lineTotal = item.unit_price * item.quantity;
          const effectiveDiscount =
            discAmt > 0
              ? Math.min(discAmt, lineTotal)
              : lineTotal * (disc / 100);
          const discountedTotal = lineTotal - effectiveDiscount;
          const hasDiscount = effectiveDiscount > 0;
          return (
            <div key={item.medicine_id}>
              <p>{item.name}</p>
              <div className="flex justify-between pl-4">
                <span>
                  {item.quantity} \u00d7 {formatCurrency(item.unit_price)}
                  {hasDiscount && (
                    <span className="text-[10px]">
                      {" "}
                      ({discAmt > 0 ? `-KES ${discAmt}` : `-${disc}%`})
                    </span>
                  )}
                </span>
                {hasDiscount ? (
                  <span>
                    <span className="line-through text-gray-400 text-[10px] mr-1">
                      {formatCurrency(lineTotal)}
                    </span>
                    {formatCurrency(discountedTotal)}
                  </span>
                ) : (
                  <span>{formatCurrency(lineTotal)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* Total */}
      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL</span>
        <span>{formatCurrency(total)}</span>
      </div>

      <div className="flex justify-between mt-1">
        <span>Payment</span>
        <span>{paymentMethod.toUpperCase()}</span>
      </div>

      {cashTendered !== undefined && (
        <div className="flex justify-between mt-1">
          <span>Cash Tendered</span>
          <span>{formatCurrency(cashTendered)}</span>
        </div>
      )}

      {change !== undefined && change > 0 && (
        <div className="flex justify-between mt-1 font-bold">
          <span>Change</span>
          <span>{formatCurrency(change)}</span>
        </div>
      )}

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* Footer */}
      <div className="text-center text-[10px] mt-4">
        <p>Served by: {cashierName}</p>
        <p className="mt-2">Thank you for your purchase!</p>
        <p className="mt-1 font-bold">Linmaks PharmaCare</p>
      </div>
    </div>
  );
}
