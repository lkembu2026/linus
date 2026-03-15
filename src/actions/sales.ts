"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { generateReceiptNumber } from "@/lib/utils";
import {
  sendReceiptEmail,
  sendAuditEmail,
  sendLowStockEmail,
} from "@/lib/email";
import { generateReceiptHtml } from "@/lib/receipt-html";
import { saveReceipt } from "@/actions/receipts";
import { getEffectiveBranchId } from "@/lib/branch-server";
import type { CartItem } from "@/types";
import type { Sale } from "@/types/database";

export async function createSale(
  items: CartItem[],
  paymentMethod: string,
  totalAmount: number,
  options?: {
    paidAmount?: number;
    balanceDue?: number;
    mpesaCode?: string;
  },
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  if (!user || !branchId) {
    return { error: "User not authenticated or not assigned to a branch" };
  }

  try {
    const paidAmount = Number(options?.paidAmount ?? totalAmount);
    const balanceDue = Number(options?.balanceDue ?? 0);

    // 1. Create the sale record
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        branch_id: branchId,
        cashier_id: user.id,
        receipt_number: generateReceiptNumber(),
        total_amount: totalAmount,
        payment_method: paymentMethod,
      })
      .select()
      .single();

    if (saleError) throw saleError;

    const saleData = sale as unknown as Sale;

    // 2. Create sale items
    const saleItems = items.map((item) => {
      const lineTotal = item.unit_price * item.quantity;
      const discAmt = item.discount_amount ?? 0;
      // Convert flat KES discount to equivalent percentage for DB storage
      const effectivePercent =
        discAmt > 0 && lineTotal > 0
          ? Math.round((discAmt / lineTotal) * 10000) / 100
          : (item.discount_percent ?? 0);
      return {
        sale_id: saleData.id,
        medicine_id: item.medicine_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: effectivePercent,
      };
    });

    const { error: itemsError } = await supabase
      .from("sale_items")
      .insert(saleItems);

    if (itemsError) throw itemsError;

    // 3. Batch-fetch all medicine stock in one query, then validate & deduct
    const medIds = items.map((i) => i.medicine_id);
    const { data: medsData } = await supabase
      .from("medicines")
      .select("id, quantity_in_stock, reorder_level, category")
      .in("id", medIds)
      .eq("branch_id", branchId);

    const medsById = new Map(
      (
        (medsData ?? []) as unknown as {
          id: string;
          quantity_in_stock: number;
          reorder_level: number;
          category: string;
        }[]
      ).map((m) => [m.id, m]),
    );

    // Validate all stock availability first
    for (const item of items) {
      const med = medsById.get(item.medicine_id);
      if (!med || med.quantity_in_stock < item.quantity) {
        await supabase
          .from("sales")
          .update({ is_voided: true, voided_by: user.id })
          .eq("id", saleData.id);
        return { error: `Insufficient stock for ${item.name}` };
      }
    }

    // All stock is valid — deduct in parallel
    const lowStockAfterSale: {
      name: string;
      category: string;
      quantity_in_stock: number;
      reorder_level: number;
    }[] = [];

    const stockUpdates = items.map((item) => {
      const med = medsById.get(item.medicine_id)!;
      const newQty = med.quantity_in_stock - item.quantity;

      if (newQty <= med.reorder_level) {
        lowStockAfterSale.push({
          name: item.name,
          category: med.category ?? "Other",
          quantity_in_stock: newQty,
          reorder_level: med.reorder_level,
        });
      }

      return supabase
        .from("medicines")
        .update({ quantity_in_stock: newQty })
        .eq("id", item.medicine_id)
        .eq("branch_id", branchId);
    });

    const stockResults = await Promise.all(stockUpdates);
    const stockError = stockResults.find((r) => r.error);
    if (stockError?.error) throw stockError.error;

    // 4. Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_sale",
      details: {
        sale_id: saleData.id,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        paid_amount: paidAmount,
        balance_due: balanceDue,
        mpesa_code: options?.mpesaCode ?? null,
        items_count: items.length,
      },
    });

    const cashierName = user.full_name ?? "Staff";
    const { data: branchData } = await supabase
      .from("branches")
      .select("name")
      .eq("id", branchId)
      .single();
    const branchName =
      (branchData as { name: string } | null)?.name ??
      user.branch?.name ??
      "Branch";
    const itemsSummary = items
      .map((i) => `${i.name} \u00d7${i.quantity}`)
      .join(", ");
    const now = new Date();
    const dateStr = now.toLocaleString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Generate premium receipt HTML
    const receiptHtml = generateReceiptHtml({
      receiptNo: saleData.receipt_number,
      items: items.map((i) => {
        const lineTotal = i.unit_price * i.quantity;
        const discAmt = i.discount_amount ?? 0;
        const effectivePercent =
          discAmt > 0 && lineTotal > 0
            ? Math.round((discAmt / lineTotal) * 10000) / 100
            : (i.discount_percent ?? 0);
        return {
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_percent: effectivePercent,
        };
      }),
      total: totalAmount,
      paymentMethod,
      paidAmount,
      balanceDue,
      cashierName,
      branchName,
      date: dateStr,
    });

    const receiptSaveResult = await saveReceipt({
      saleId: saleData.id,
      receiptNo: saleData.receipt_number,
      receiptHtml,
      totalAmount,
      paymentMethod,
      cashierName,
      branchName,
      itemsSummary,
    });

    if (receiptSaveResult?.error) {
      console.error("[Receipt] Save failed:", receiptSaveResult.error);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/receipts");

    const sideEffects: Promise<unknown>[] = [
      sendReceiptEmail({
        receiptNo: saleData.receipt_number,
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        total: totalAmount,
        paymentMethod,
        cashierName,
        branchName,
        paidAmount,
        balanceDue,
        mpesaCode: options?.mpesaCode,
        saleDate: dateStr,
      }),
      sendAuditEmail({
        action: "create_sale",
        userName: cashierName,
        details: {
          sale_id: saleData.id,
          receipt_number: saleData.receipt_number,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          paid_amount: paidAmount,
          balance_due: balanceDue,
          items_count: items.length,
        },
      }),
    ];

    if (lowStockAfterSale.length > 0) {
      sideEffects.push(sendLowStockEmail({ items: lowStockAfterSale }));
    }

    const sideEffectResults = await Promise.allSettled(sideEffects);
    sideEffectResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const labels = ["receipt email", "audit email", "low stock email"];
        console.error(
          `[Email] ${labels[index] ?? "sale side effect"} failed:`,
          result.reason,
        );
      }
    });

    return {
      success: true,
      saleId: saleData.id,
      receiptNumber: saleData.receipt_number,
      receiptHtml,
      receiptSaved: !receiptSaveResult?.error,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create sale";
    return { error: message };
  }
}

export async function searchMedicines(
  query: string,
  categories?: string[],
  includeOutOfStock = false,
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  if (!user || !branchId) return [];

  let q = supabase
    .from("medicines")
    .select(
      "id, name, generic_name, category, barcode, unit_price, quantity_in_stock, dispensing_unit",
    )
    .eq("branch_id", branchId)
    .or(
      `name.ilike.%${query}%,generic_name.ilike.%${query}%,barcode.eq.${query}`,
    );

  if (!includeOutOfStock) {
    q = q.gt("quantity_in_stock", 0);
  }

  if (categories && categories.length > 0) {
    q = q.in("category", categories);
  }

  const { data } = await q.limit(20);

  type MedResult = {
    id: string;
    name: string;
    generic_name: string | null;
    category: string;
    barcode: string | null;
    unit_price: number;
    quantity_in_stock: number;
    dispensing_unit: string | null;
  };

  return ((data ?? []) as unknown as MedResult[]).map((item) => ({
    medicine_id: item.id,
    name: item.name,
    generic_name: item.generic_name,
    category: item.category,
    barcode: item.barcode,
    unit_price: Number(item.unit_price),
    max_quantity: item.quantity_in_stock,
    dispensing_unit: item.dispensing_unit,
  }));
}

export async function voidSale(saleId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user || !hasPermission(user.role, "void_sale")) {
    return { error: "Only admins can void sales" };
  }

  // Get sale
  const { data: sale } = await supabase
    .from("sales")
    .select("branch_id, is_voided")
    .eq("id", saleId)
    .single();

  const saleRow = sale as { branch_id: string; is_voided: boolean } | null;

  if (!saleRow || saleRow.is_voided) {
    return { error: "Sale not found or already voided" };
  }

  // Get sale items to restore stock
  const { data: saleItems } = await supabase
    .from("sale_items")
    .select("medicine_id, quantity")
    .eq("sale_id", saleId);

  type SaleItemResult = { medicine_id: string; quantity: number };
  const items = (saleItems ?? []) as unknown as SaleItemResult[];

  // Restore stock
  for (const item of items) {
    const { data: medicine } = await supabase
      .from("medicines")
      .select("quantity_in_stock")
      .eq("id", item.medicine_id)
      .eq("branch_id", saleRow.branch_id)
      .single();

    const med = medicine as { quantity_in_stock: number } | null;
    if (med) {
      await supabase
        .from("medicines")
        .update({
          quantity_in_stock: med.quantity_in_stock + item.quantity,
        })
        .eq("id", item.medicine_id)
        .eq("branch_id", saleRow.branch_id);
    }
  }

  // Void the sale
  await supabase
    .from("sales")
    .update({ is_voided: true, voided_by: user.id })
    .eq("id", saleId);

  // Audit log
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "void_sale",
    details: { sale_id: saleId, reason: "Admin void" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/inventory");

  // Audit email for void (fire-and-forget)
  sendAuditEmail({
    action: "void_sale",
    userName: user.full_name ?? "Admin",
    details: { sale_id: saleId, reason: "Admin void" },
  }).catch(() => {});

  return { success: true };
}

export type RecentSale = Sale & {
  items_summary?: string;
};

export async function getRecentSales(
  limit: number = 20,
  categories?: string[],
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  if (!user) return [] as RecentSale[];

  let query = supabase
    .from("sales")
    .select(
      "id, receipt_number, total_amount, payment_method, is_voided, created_at, branch_id, cashier_id, voided_by",
    )
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  // If categories filter is provided, get sales with matching sale_items
  if (categories && categories.length > 0) {
    let medsQuery = supabase
      .from("medicines")
      .select("id")
      .in("category", categories);

    if (branchId) {
      medsQuery = medsQuery.eq("branch_id", branchId);
    }

    const { data: medsData } = await medsQuery;

    const validMedIds = ((medsData ?? []) as unknown as { id: string }[]).map(
      (m) => m.id,
    );

    if (validMedIds.length > 0) {
      const CHUNK_SIZE = 100;
      const saleIdSet = new Set<string>();

      for (let i = 0; i < validMedIds.length; i += CHUNK_SIZE) {
        const chunk = validMedIds.slice(i, i + CHUNK_SIZE);
        const { data: saleItemsData } = await supabase
          .from("sale_items")
          .select("sale_id")
          .in("medicine_id", chunk);

        for (const row of (saleItemsData ?? []) as unknown as {
          sale_id: string;
        }[]) {
          saleIdSet.add(row.sale_id);
        }
      }

      const validSaleIds = [...saleIdSet];

      if (validSaleIds.length === 0) return [] as RecentSale[];

      query = query.in("id", validSaleIds);
    } else {
      return [] as RecentSale[];
    }
  }

  const { data: salesData } = await query.limit(limit);
  const sales = (salesData ?? []) as unknown as Sale[];

  if (sales.length === 0) return [] as RecentSale[];

  // Fetch sale items with medicine names for each sale
  const saleIds = sales.map((s) => s.id);
  const { data: saleItemsData } = await supabase
    .from("sale_items")
    .select("sale_id, quantity, medicine_id")
    .in("sale_id", saleIds);

  type SaleItemRow = { sale_id: string; quantity: number; medicine_id: string };
  const saleItems = (saleItemsData ?? []) as unknown as SaleItemRow[];

  // Get unique medicine IDs and fetch names
  const medIds = [...new Set(saleItems.map((si) => si.medicine_id))];
  const { data: medsData } =
    medIds.length > 0
      ? await supabase.from("medicines").select("id, name").in("id", medIds)
      : { data: [] };
  const medsMap = new Map(
    ((medsData ?? []) as unknown as { id: string; name: string }[]).map((m) => [
      m.id,
      m.name,
    ]),
  );

  // Build items summary per sale
  const salesWithItems: RecentSale[] = sales.map((sale) => {
    const saleSpecificItems = saleItems.filter((si) => si.sale_id === sale.id);
    const summary = saleSpecificItems
      .map((si) => {
        const medName = medsMap.get(si.medicine_id) ?? "Unknown";
        return `${medName} ×${si.quantity}`;
      })
      .join(", ");
    return { ...sale, items_summary: summary };
  });

  return salesWithItems;
}

export async function clearAllSalesHistory() {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return { error: "Only super admin can clear sales history" };
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // Delete in correct order: credits (refs sales) → receipts (refs sales) → sale_items (cascade) → sales
  const { error: creditsErr } = await supabase
    .from("credits")
    .delete()
    .not("id", "is", null); // delete all rows

  if (creditsErr) return { error: `Credits: ${creditsErr.message}` };

  const { error: receiptsErr } = await supabase
    .from("receipts")
    .delete()
    .not("id", "is", null);

  if (receiptsErr) return { error: `Receipts: ${receiptsErr.message}` };

  // sale_items cascade on sales delete, but delete explicitly to be safe
  const { error: itemsErr } = await supabase
    .from("sale_items")
    .delete()
    .not("id", "is", null);

  if (itemsErr) return { error: `Sale items: ${itemsErr.message}` };

  const { error: salesErr } = await supabase
    .from("sales")
    .delete()
    .not("id", "is", null);

  if (salesErr) return { error: `Sales: ${salesErr.message}` };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "clear_all_sales_history",
    details: { cleared_at: new Date().toISOString() },
  });

  revalidatePath("/sales");
  revalidatePath("/sales-history");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/credits");
  revalidatePath("/receipts");

  return { success: true };
}
