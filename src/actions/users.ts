"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@/types/database";

export async function getUsers() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_users")) return [];

  let query = supabase
    .from("users")
    .select("*")
    .order("full_name", { ascending: true });

  // Hide super_admin users from non-super_admin callers
  if (user.role !== "super_admin") {
    query = query.neq("role", "super_admin");
  }

  const { data, error } = await query;

  if (error) {
    console.error("getUsers error:", error);
    return [];
  }

  return (data ?? []) as unknown as import("@/types/database").User[];
}

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_users")) {
    return { error: "Admin access required" };
  }

  // Only super_admin can assign or remove super_admin role
  if (role === "super_admin" && user.role !== "super_admin") {
    return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("users")
    .update({ role: role as UserRole })
    .eq("id", userId);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "change_user_role",
    details: { target_user_id: userId, new_role: role },
  });

  revalidatePath("/users");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateUserBranch(userId: string, branchId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_users")) {
    return { error: "Admin access required" };
  }

  const { error } = await supabase
    .from("users")
    .update({ branch_id: branchId })
    .eq("id", userId);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "change_user_branch",
    details: { target_user_id: userId, new_branch_id: branchId },
  });

  revalidatePath("/users");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_users")) {
    return { error: "Admin access required" };
  }

  const { error } = await supabase
    .from("users")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: isActive ? "activate_user" : "deactivate_user",
    details: { target_user_id: userId },
  });

  revalidatePath("/users");
  revalidatePath("/", "layout");
  return { success: true };
}
