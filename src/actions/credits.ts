"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import { sendCreditEmail, sendCreditSettledEmail } from "@/lib/email";
import type { Credit } from "@/types/database";

export type CreditWithBalance = Credit & { balance: number };

export async function getCredits(
  filter: "outstanding" | "settled" | "all" = "outstanding",
): Promise<CreditWithBalance[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const isAdmin = user.role === "admin";

  let query = supabase
    .from("credits")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isAdmin && user.branch_id) {
    query = query.eq("branch_id", user.branch_id);
  }

  if (filter === "outstanding") {
    query = query.eq("is_settled", false);
  } else if (filter === "settled") {
    query = query.eq("is_settled", true);
  }

  const { data } = await query;
  const credits = (data ?? []) as unknown as Credit[];

  return credits.map((c) => ({
    ...c,
    balance: c.amount - c.amount_paid,
  }));
}

export async function getCreditStats() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { totalOutstanding: 0, totalClients: 0, totalSettled: 0 };

  const isAdmin = user.role === "admin";

  let query = supabase
    .from("credits")
    .select("amount, amount_paid, is_settled, branch_id");
  if (!isAdmin && user.branch_id) {
    query = query.eq("branch_id", user.branch_id);
  }

  const { data } = await query;
  const credits = (data ?? []) as unknown as {
    amount: number;
    amount_paid: number;
    is_settled: boolean;
  }[];

  const outstanding = credits.filter((c) => !c.is_settled);
  const settled = credits.filter((c) => c.is_settled);

  return {
    totalOutstanding: outstanding.reduce(
      (s, c) => s + (c.amount - c.amount_paid),
      0,
    ),
    totalClients: outstanding.length,
    totalSettled: settled.reduce((s, c) => s + c.amount, 0),
  };
}

export async function createCredit(data: {
  saleId: string;
  receiptNo: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  medicineDetails: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || !user.branch_id) return { error: "Not authenticated" };

  const { error } = await supabase.from("credits").insert({
    branch_id: user.branch_id,
    sale_id: data.saleId,
    created_by: user.id,
    customer_name: data.customerName,
    customer_phone: data.customerPhone ?? null,
    amount: data.amount,
    amount_paid: 0,
    medicine_details: data.medicineDetails,
    notes: data.notes ?? null,
    is_settled: false,
  } as any);

  if (error) return { error: error.message };

  // Audit log
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "create_credit",
    details: {
      customer_name: data.customerName,
      amount: data.amount,
      receipt_no: data.receiptNo,
    },
  });

  revalidatePath("/credits");
  revalidatePath("/dashboard");

  // Notify admin
  sendCreditEmail({
    receiptNo: data.receiptNo,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    amount: data.amount,
    medicines: data.medicineDetails,
    cashierName: user.full_name ?? "Staff",
    branchName: (user as any).branch?.name ?? "Branch",
    notes: data.notes,
  }).catch((err) => console.error("[Email] Credit email failed:", err));

  return { success: true };
}

export async function recordPayment(creditId: string, amountPaid: number) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  // Get current credit
  const { data: creditData } = await supabase
    .from("credits")
    .select("*")
    .eq("id", creditId)
    .single();

  const credit = creditData as unknown as Credit | null;
  if (!credit) return { error: "Credit not found" };

  const newAmountPaid = credit.amount_paid + amountPaid;
  const isNowSettled = newAmountPaid >= credit.amount;

  const { error } = await supabase
    .from("credits")
    .update({
      amount_paid: newAmountPaid,
      is_settled: isNowSettled,
      settled_at: isNowSettled ? new Date().toISOString() : null,
      settled_by: isNowSettled ? user.id : null,
    } as any)
    .eq("id", creditId);

  if (error) return { error: error.message };

  // Audit log
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: isNowSettled ? "settle_credit" : "partial_payment_credit",
    details: {
      credit_id: creditId,
      customer_name: credit.customer_name,
      amount_paid: amountPaid,
      total: credit.amount,
    },
  });

  revalidatePath("/credits");
  revalidatePath("/dashboard");

  // Send email
  sendCreditSettledEmail({
    customerName: credit.customer_name,
    customerPhone: credit.customer_phone ?? undefined,
    amountSettled: amountPaid,
    totalAmount: credit.amount,
    settledBy: user.full_name ?? "Staff",
    branchName: (user as any).branch?.name ?? "Branch",
  }).catch((err) => console.error("[Email] Credit settled email failed:", err));

  return { success: true, isSettled: isNowSettled };
}
