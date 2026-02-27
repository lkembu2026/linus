"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import { generateReceiptNumber } from "@/lib/utils";
import { sendReceiptEmail, sendAuditEmail, sendLowStockEmail } from "@/lib/email";
import type { CartItem } from "@/types";
import type { Sale } from "@/types/database";

export async function createSale(
  items: CartItem[],
  paymentMethod: string,
  totalAmount: number,
) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user || !user.branch_id) {
    return { error: "User not authenticated or not assigned to a branch" };
  }

  try {
    // 1. Create the sale record
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        branch_id: user.branch_id,
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
    const saleItems = items.map((item) => ({
      sale_id: saleData.id,
      medicine_id: item.medicine_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from("sale_items")
      .insert(saleItems);

    if (itemsError) throw itemsError;

    // 3. Deduct stock for each item
    const lowStockAfterSale: { name: string; category: string; quantity_in_stock: number; reorder_level: number }[] = [];
    for (const item of items) {
      const { data: medicine } = await supabase
        .from("medicines")
        .select("quantity_in_stock, reorder_level, category")
        .eq("id", item.medicine_id)
        .eq("branch_id", user.branch_id)
        .single();

      const med = medicine as { quantity_in_stock: number; reorder_level: number; category: string } | null;

      if (!med || med.quantity_in_stock < item.quantity) {
        // Rollback: void the sale
        await supabase
          .from("sales")
          .update({ is_voided: true, voided_by: user.id })
          .eq("id", saleData.id);
        return { error: `Insufficient stock for ${item.name}` };
      }

      const { error: stockError } = await supabase
        .from("medicines")
        .update({
          quantity_in_stock: med.quantity_in_stock - item.quantity,
        })
        .eq("id", item.medicine_id)
        .eq("branch_id", user.branch_id);

      if (stockError) throw stockError;

      // Check if the deduction pushed this item below reorder level
      const newQty = med.quantity_in_stock - item.quantity;
      if (med && newQty <= med.reorder_level) {
        lowStockAfterSale.push({
          name: item.name,
          category: med.category ?? "Other",
          quantity_in_stock: newQty,
          reorder_level: med.reorder_level,
        });
      }
    }

    // 4. Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_sale",
      details: {
        sale_id: saleData.id,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        items_count: items.length,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/inventory");

    // Send receipt email to admin (fire-and-forget)
    sendReceiptEmail({
      receiptNo: saleData.receipt_number,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      total: totalAmount,
      paymentMethod,
      cashierName: user.full_name ?? "Staff",
      branchName: user.branch?.name ?? "Branch",
    }).catch(() => {});

    // Audit email for sale (fire-and-forget)
    sendAuditEmail({
      action: "create_sale",
      userName: user.full_name ?? "Staff",
      details: {
        sale_id: saleData.id,
        receipt_number: saleData.receipt_number,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        items_count: items.length,
      },
    }).catch(() => {});

    // Low stock email if any items dropped below reorder level
    if (lowStockAfterSale.length > 0) {
      sendLowStockEmail({ items: lowStockAfterSale }).catch(() => {});
    }

    return { success: true, saleId: saleData.id };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create sale";
    return { error: message };
  }
}

export async function searchMedicines(query: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user || !user.branch_id) return [];

  const { data } = await supabase
    .from("medicines")
    .select(
      "id, name, generic_name, category, barcode, unit_price, quantity_in_stock",
    )
    .eq("branch_id", user.branch_id)
    .gt("quantity_in_stock", 0)
    .or(
      `name.ilike.%${query}%,generic_name.ilike.%${query}%,barcode.eq.${query}`,
    )
    .limit(20);

  type MedResult = {
    id: string;
    name: string;
    generic_name: string | null;
    category: string;
    barcode: string | null;
    unit_price: number;
    quantity_in_stock: number;
  };

  return ((data ?? []) as unknown as MedResult[]).map((item) => ({
    medicine_id: item.id,
    name: item.name,
    generic_name: item.generic_name,
    category: item.category,
    barcode: item.barcode,
    unit_price: Number(item.unit_price),
    max_quantity: item.quantity_in_stock,
  }));
}

export async function voidSale(saleId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
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

export async function getRecentSales() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) return [] as Sale[];

  const isAdmin = user.role === "admin";

  let query = supabase
    .from("sales")
    .select(
      "id, receipt_number, total_amount, payment_method, is_voided, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (!isAdmin && user.branch_id) {
    query = query.eq("branch_id", user.branch_id);
  }

  const { data } = await query;
  return (data ?? []) as unknown as Sale[];
}
