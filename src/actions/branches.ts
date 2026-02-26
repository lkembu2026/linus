"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import type { Branch } from "@/types/database";

export async function getBranches() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return [] as Branch[];

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

export async function createBranch(formData: {
  name: string;
  location?: string;
  phone?: string;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Admin access required" };

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
  formData: { name?: string; location?: string; phone?: string },
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Admin access required" };

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
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Admin access required" };

  const { error } = await supabase.from("branches").delete().eq("id", id);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "delete_branch",
    details: { branch_id: id },
  });

  revalidatePath("/branches");
  return { success: true };
}
