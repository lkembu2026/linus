"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { sendPasswordResetNotifyEmail, sendAuditEmail } from "@/lib/email";
import { cache } from "react";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

import type { User } from "@/types/database";

type CurrentUser = User & {
  branch?: { name: string; location: string | null } | null;
};

// React cache() deduplicates calls within a single server request
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: user } = await supabase
    .from("users")
    .select("*, branch:branches(name, location)")
    .eq("id", authUser.id)
    .single();

  return user as CurrentUser | null;
});

export async function registerUser(data: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  branch_id: string;
}) {
  const supabase = await createClient();

  // Only admins can register new users
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "Only administrators can create new users" };
  }

  const { email, password, full_name, role, branch_id } = data;

  // Create auth user
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    return { error: authError.message };
  }

  // Create user profile
  const { error: profileError } = await supabase.from("users").insert({
    id: authData.user.id,
    branch_id: branch_id || null,
    full_name,
    email,
    role,
    is_active: true,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    user_id: currentUser.id,
    action: "register_user",
    details: { email, role, branch_id },
  });

  sendAuditEmail({
    action: "register_user",
    userName: currentUser.full_name ?? "Admin",
    details: { email, role, branch_id },
  }).catch(() => {});

  return { success: true };
}

export async function resetPassword(email: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/login`,
  });

  if (error) {
    return { error: error.message };
  }

  // Notify admin about password reset request
  sendPasswordResetNotifyEmail(email).catch(() => {});

  return { success: true };
}

export async function updateProfile(fullName: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName })
    .eq("id", authUser.id);

  if (error) return { error: error.message };
  return { success: true };
}
