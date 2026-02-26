"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
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

  revalidatePath("/inventory");
  return { success: true };
}

export async function updateMedicine(
  id: string,
  formData: {
    name?: string;
    generic_name?: string;
    category?: string;
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
    .select("quantity_in_stock, name")
    .eq("id", medicineId)
    .single();

  const medicine = medData as {
    quantity_in_stock: number;
    name: string;
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

  revalidatePath("/inventory");
  return { success: true };
}
