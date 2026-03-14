"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import type { Branch } from "@/types/database";

type BranchModePayload = {
  enable_pharmacy?: boolean;
  enable_beauty?: boolean;
};

function hasAtLeastOneModeEnabled(payload: BranchModePayload) {
  return payload.enable_pharmacy !== false || payload.enable_beauty !== false;
}

export async function getBranches() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_branches")) {
    return [] as Branch[];
  }

  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("getBranches error:", error);
    return [] as Branch[];
  }

  return (data ?? []) as unknown as Branch[];
}

export async function getTransferBranches() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "create_transfer")) {
    return [] as Pick<Branch, "id" | "name">[];
  }

  const { data, error } = await supabase
    .from("branches")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("getTransferBranches error:", error);
    return [] as Pick<Branch, "id" | "name">[];
  }

  return (data ?? []) as Pick<Branch, "id" | "name">[];
}

export async function createBranch(formData: {
  name: string;
  location?: string;
  phone?: string;
  enable_pharmacy?: boolean;
  enable_beauty?: boolean;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_branches")) {
    return { error: "Admin access required" };
  }

  if (!hasAtLeastOneModeEnabled(formData)) {
    return { error: "A branch must have at least one mode enabled" };
  }

  const { error } = await supabase.from("branches").insert(formData);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "create_branch",
    details: { branch_name: formData.name },
  });

  revalidatePath("/branches");
  return { success: true };
}

export async function updateBranch(
  id: string,
  formData: {
    name?: string;
    location?: string;
    phone?: string;
    enable_pharmacy?: boolean;
    enable_beauty?: boolean;
  },
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_branches")) {
    return { error: "Admin access required" };
  }

  if (
    formData.enable_pharmacy !== undefined ||
    formData.enable_beauty !== undefined
  ) {
    const { data: existingBranch } = await supabase
      .from("branches")
      .select("enable_pharmacy, enable_beauty")
      .eq("id", id)
      .single();

    const nextModes = {
      enable_pharmacy:
        formData.enable_pharmacy ?? existingBranch?.enable_pharmacy ?? true,
      enable_beauty:
        formData.enable_beauty ?? existingBranch?.enable_beauty ?? true,
    };

    if (!hasAtLeastOneModeEnabled(nextModes)) {
      return { error: "A branch must have at least one mode enabled" };
    }
  }

  const { error } = await supabase
    .from("branches")
    .update(formData)
    .eq("id", id);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "update_branch",
    details: { branch_id: id, updates: formData },
  });

  revalidatePath("/branches");
  return { success: true };
}

export async function deleteBranch(id: string) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_branches")) {
    return { error: "Admin access required" };
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminSupabase = createAdminClient();

  // Get all medicine IDs for this branch (needed to clean sale_items & transfers)
  const { data: medicines } = await adminSupabase
    .from("medicines")
    .select("id")
    .eq("branch_id", id);
  const medicineIds = (medicines ?? []).map((m: { id: string }) => m.id);

  // 1. Delete sale_items that reference this branch's medicines
  if (medicineIds.length > 0) {
    await adminSupabase
      .from("sale_items")
      .delete()
      .in("medicine_id", medicineIds);
  }

  // 2. Delete dependent records in parallel (all reference branch_id, not each other)
  await Promise.all([
    adminSupabase
      .from("stock_transfers")
      .delete()
      .or(`from_branch_id.eq.${id},to_branch_id.eq.${id}`),
    adminSupabase.from("sales").delete().eq("branch_id", id),
    adminSupabase.from("medicines").delete().eq("branch_id", id),
    adminSupabase.from("notifications").delete().eq("branch_id", id),
    adminSupabase.from("saved_reports").delete().eq("branch_id", id),
    adminSupabase
      .from("users")
      .update({ branch_id: null })
      .eq("branch_id", id),
  ]);

  // 3. Delete the branch itself (must wait for dependents)
  const { error } = await adminSupabase.from("branches").delete().eq("id", id);

  if (error) return { error: error.message };

  // 9. Log the deletion
  await adminSupabase.from("audit_logs").insert({
    user_id: user.id,
    action: "delete_branch",
    details: { branch_id: id },
  });

  revalidatePath("/branches");
  return { success: true };
}
