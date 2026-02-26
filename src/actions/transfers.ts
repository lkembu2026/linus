"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import type { StockTransfer } from "@/types/database";

export async function getTransfers() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [] as StockTransfer[];

  let query = supabase
    .from("stock_transfers")
    .select("*")
    .order("created_at", { ascending: false });

  if (user.role !== "admin") {
    query = query.or(
      `from_branch_id.eq.${user.branch_id},to_branch_id.eq.${user.branch_id}`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("getTransfers error:", error);
    return [] as StockTransfer[];
  }

  return (data ?? []) as unknown as StockTransfer[];
}

export async function createTransfer(formData: {
  medicine_id: string;
  from_branch_id: string;
  to_branch_id: string;
  quantity: number;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  if (formData.from_branch_id === formData.to_branch_id) {
    return { error: "Cannot transfer to the same branch" };
  }

  // Check stock availability
  const { data: medData } = await supabase
    .from("medicines")
    .select("quantity_in_stock, name")
    .eq("id", formData.medicine_id)
    .eq("branch_id", formData.from_branch_id)
    .single();

  const medicine = medData as {
    quantity_in_stock: number;
    name: string;
  } | null;

  if (!medicine) return { error: "Medicine not found in source branch" };
  if (medicine.quantity_in_stock < formData.quantity) {
    return {
      error: `Insufficient stock. Available: ${medicine.quantity_in_stock}`,
    };
  }

  const { error } = await supabase.from("stock_transfers").insert({
    ...formData,
    requested_by: user.id,
    status: "pending",
  });

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "create_transfer",
    details: {
      medicine_name: medicine.name,
      quantity: formData.quantity,
    },
  });

  revalidatePath("/transfers");
  return { success: true };
}

export async function approveTransfer(transferId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Admin access required" };

  // Get transfer details
  const { data: transferData } = await supabase
    .from("stock_transfers")
    .select("*")
    .eq("id", transferId)
    .single();

  const transfer = transferData as unknown as StockTransfer | null;

  if (!transfer) return { error: "Transfer not found" };
  if (transfer.status !== "pending")
    return { error: "Transfer is not pending" };

  // Deduct from source
  const { data: sourceData } = await supabase
    .from("medicines")
    .select("quantity_in_stock")
    .eq("id", transfer.medicine_id)
    .eq("branch_id", transfer.from_branch_id)
    .single();

  const sourceMed = sourceData as { quantity_in_stock: number } | null;

  if (!sourceMed || sourceMed.quantity_in_stock < transfer.quantity) {
    return { error: "Insufficient stock in source branch" };
  }

  await supabase
    .from("medicines")
    .update({
      quantity_in_stock: sourceMed.quantity_in_stock - transfer.quantity,
    })
    .eq("id", transfer.medicine_id)
    .eq("branch_id", transfer.from_branch_id);

  // Add to destination
  const { data: destData } = await supabase
    .from("medicines")
    .select("id, quantity_in_stock")
    .eq("id", transfer.medicine_id)
    .eq("branch_id", transfer.to_branch_id)
    .single();

  const destMed = destData as { id: string; quantity_in_stock: number } | null;

  if (destMed) {
    await supabase
      .from("medicines")
      .update({
        quantity_in_stock: destMed.quantity_in_stock + transfer.quantity,
      })
      .eq("id", destMed.id);
  }

  // Update transfer status
  const { error } = await supabase
    .from("stock_transfers")
    .update({ status: "approved" })
    .eq("id", transferId);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "approve_transfer",
    details: { transfer_id: transferId },
  });

  revalidatePath("/transfers");
  return { success: true };
}

export async function rejectTransfer(transferId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Admin access required" };

  const { error } = await supabase
    .from("stock_transfers")
    .update({ status: "rejected" })
    .eq("id", transferId);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "reject_transfer",
    details: { transfer_id: transferId },
  });

  revalidatePath("/transfers");
  return { success: true };
}
