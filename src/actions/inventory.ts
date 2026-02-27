"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import { sendAuditEmail, sendLowStockEmail } from "@/lib/email";
import type { Medicine } from "@/types/database";

export async function getMedicines(search?: string, category?: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [] as Medicine[];

  let query = supabase
    .from("medicines")
    .select("*")
    .order("name", { ascending: true });

  if (user.role !== "admin") {
    query = query.eq("branch_id", user.branch_id!);
  }

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,generic_name.ilike.%${search}%,barcode.ilike.%${search}%`,
    );
  }

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getMedicines error:", error);
    return [] as Medicine[];
  }

  return (data ?? []) as unknown as Medicine[];
}

export async function getMedicineById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medicines")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as Medicine | null;
}

export async function createMedicine(formData: {
  name: string;
  generic_name?: string;
  category: string;
  dispensing_unit?: string;
  unit_price: number;
  cost_price: number;
  quantity_in_stock: number;
  reorder_level: number;
  expiry_date?: string;
  barcode?: string;
  requires_prescription: boolean;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "pharmacist") {
    return { error: "Insufficient permissions" };
  }

  const { error } = await supabase.from("medicines").insert({
    ...formData,
    branch_id: user.branch_id!,
    created_by: user.id,
  });

  if (error) {
    console.error("createMedicine error:", error);
    return { error: error.message };
  }

  // Log audit
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "create_medicine",
    details: { medicine_name: formData.name },
  });

  // Send audit email for new medicine
  sendAuditEmail({
    action: "create_medicine",
    userName: user.full_name ?? "Staff",
    details: {
      medicine_name: formData.name,
      category: formData.category,
      quantity: formData.quantity_in_stock,
    },
  }).catch(() => {});

  revalidatePath("/inventory");
  return { success: true };
}

export async function updateMedicine(
  id: string,
  formData: {
    name?: string;
    generic_name?: string;
    category?: string;
    dispensing_unit?: string;
    unit_price?: number;
    cost_price?: number;
    quantity_in_stock?: number;
    reorder_level?: number;
    expiry_date?: string;
    barcode?: string;
    requires_prescription?: boolean;
  },
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "pharmacist") {
    return { error: "Insufficient permissions" };
  }

  const { error } = await supabase
    .from("medicines")
    .update(formData)
    .eq("id", id);

  if (error) {
    console.error("updateMedicine error:", error);
    return { error: error.message };
  }

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "update_medicine",
    details: { medicine_id: id, updates: formData },
  });

  revalidatePath("/inventory");
  return { success: true };
}

export async function deleteMedicine(id: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin") {
    return { error: "Only admins can delete medicines" };
  }

  const { error } = await supabase.from("medicines").delete().eq("id", id);

  if (error) {
    console.error("deleteMedicine error:", error);
    return { error: error.message };
  }

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "delete_medicine",
    details: { medicine_id: id },
  });

  sendAuditEmail({
    action: "delete_medicine",
    userName: user.full_name ?? "Admin",
    details: { medicine_id: id },
  }).catch(() => {});

  revalidatePath("/inventory");
  return { success: true };
}

export async function adjustStock(
  medicineId: string,
  adjustment: number,
  reason: string,
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "pharmacist") {
    return { error: "Insufficient permissions" };
  }

  // Get current stock
  const { data: medData, error: fetchError } = await supabase
    .from("medicines")
    .select("quantity_in_stock, name, reorder_level, category")
    .eq("id", medicineId)
    .single();

  const medicine = medData as {
    quantity_in_stock: number;
    name: string;
    reorder_level: number;
    category: string;
  } | null;
  if (fetchError || !medicine) return { error: "Medicine not found" };

  const newStock = medicine.quantity_in_stock + adjustment;
  if (newStock < 0) return { error: "Insufficient stock for this adjustment" };

  const { error } = await supabase
    .from("medicines")
    .update({ quantity_in_stock: newStock })
    .eq("id", medicineId);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "stock_adjustment",
    details: {
      medicine_id: medicineId,
      medicine_name: medicine.name,
      previous_stock: medicine.quantity_in_stock,
      adjustment,
      new_stock: newStock,
      reason,
    },
  });

  sendAuditEmail({
    action: "stock_adjustment",
    userName: user.full_name ?? "Staff",
    details: {
      medicine_name: medicine.name,
      previous_stock: medicine.quantity_in_stock,
      adjustment,
      new_stock: newStock,
      reason,
    },
  }).catch(() => {});

  // Check if the adjusted medicine is now low stock
  if (newStock <= medicine.reorder_level) {
    sendLowStockEmail({
      items: [
        {
          name: medicine.name,
          category: medicine.category,
          quantity_in_stock: newStock,
          reorder_level: medicine.reorder_level,
        },
      ],
    }).catch(() => {});
  }

  revalidatePath("/inventory");
  return { success: true };
}

export async function bulkCreateMedicines(
  rows: {
    name: string;
    generic_name?: string;
    category: string;
    unit_price: number;
    cost_price: number;
    quantity_in_stock: number;
    reorder_level: number;
    expiry_date?: string;
    barcode?: string;
    dispensing_unit?: string;
    requires_prescription: boolean;
  }[],
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin" && user.role !== "pharmacist") {
    return { error: "Insufficient permissions" };
  }

  const records = rows.map((row) => ({
    ...row,
    branch_id: user.branch_id!,
    created_by: user.id,
  }));

  const { error } = await supabase.from("medicines").insert(records as any);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "bulk_import_medicines",
    details: { count: rows.length },
  });

  revalidatePath("/inventory");
  return { success: true, count: rows.length };
}
