"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import { sendTransferEmail, sendAuditEmail } from "@/lib/email";
import type { StockTransfer } from "@/types/database";

export async function getTransfers() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [] as StockTransfer[];

  let query = supabase
    .from("stock_transfers")
    .select(
      `
      *,
      medicine:medicines!stock_transfers_medicine_id_fkey(id, name),
      from_branch:branches!stock_transfers_from_branch_id_fkey(id, name),
      to_branch:branches!stock_transfers_to_branch_id_fkey(id, name),
      requested_by_user:users!stock_transfers_requested_by_fkey(id, full_name)
    `,
    )
    .order("created_at", { ascending: false });

  if (user.role !== "admin") {
    query = query.or(
      `from_branch_id.eq.${user.branch_id},to_branch_id.eq.${user.branch_id}`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("getTransfers error:", error);
    return [];
  }

  return (data ?? []) as unknown as (StockTransfer & {
    medicine: { id: string; name: string } | null;
    from_branch: { id: string; name: string } | null;
    to_branch: { id: string; name: string } | null;
    requested_by_user: { id: string; full_name: string } | null;
  })[];
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

  // Fetch branch names for the email
  const { data: fromBr } = await supabase
    .from("branches")
    .select("name")
    .eq("id", formData.from_branch_id)
    .single();
  const { data: toBr } = await supabase
    .from("branches")
    .select("name")
    .eq("id", formData.to_branch_id)
    .single();

  sendTransferEmail({
    medicineName: medicine.name,
    quantity: formData.quantity,
    fromBranch: (fromBr as { name: string } | null)?.name ?? "Unknown",
    toBranch: (toBr as { name: string } | null)?.name ?? "Unknown",
    requestedBy: user.full_name ?? "Staff",
    status: "pending",
  }).catch(() => {});

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

  // Fetch details for email
  const { data: medName } = await supabase
    .from("medicines")
    .select("name")
    .eq("id", transfer.medicine_id)
    .single();
  const { data: fromBrA } = await supabase
    .from("branches")
    .select("name")
    .eq("id", transfer.from_branch_id)
    .single();
  const { data: toBrA } = await supabase
    .from("branches")
    .select("name")
    .eq("id", transfer.to_branch_id)
    .single();

  sendTransferEmail({
    medicineName: (medName as { name: string } | null)?.name ?? "Medicine",
    quantity: transfer.quantity,
    fromBranch: (fromBrA as { name: string } | null)?.name ?? "Unknown",
    toBranch: (toBrA as { name: string } | null)?.name ?? "Unknown",
    requestedBy: user.full_name ?? "Admin",
    status: "approved",
  }).catch(() => {});

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

  // Fetch details for rejection email
  const { data: rejTransfer } = await supabase
    .from("stock_transfers")
    .select("medicine_id, quantity, from_branch_id, to_branch_id")
    .eq("id", transferId)
    .single();
  const rejT = rejTransfer as {
    medicine_id: string;
    quantity: number;
    from_branch_id: string;
    to_branch_id: string;
  } | null;

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "reject_transfer",
    details: { transfer_id: transferId },
  });

  if (rejT) {
    const { data: rejMed } = await supabase
      .from("medicines")
      .select("name")
      .eq("id", rejT.medicine_id)
      .single();
    const { data: rejFrom } = await supabase
      .from("branches")
      .select("name")
      .eq("id", rejT.from_branch_id)
      .single();
    const { data: rejTo } = await supabase
      .from("branches")
      .select("name")
      .eq("id", rejT.to_branch_id)
      .single();

    sendTransferEmail({
      medicineName: (rejMed as { name: string } | null)?.name ?? "Medicine",
      quantity: rejT.quantity,
      fromBranch: (rejFrom as { name: string } | null)?.name ?? "Unknown",
      toBranch: (rejTo as { name: string } | null)?.name ?? "Unknown",
      requestedBy: user.full_name ?? "Admin",
      status: "rejected",
    }).catch(() => {});
  }

  revalidatePath("/transfers");
  return { success: true };
}
