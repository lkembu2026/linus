"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";

// ---- Save receipt to database ----

export async function saveReceipt(data: {
  saleId: string;
  receiptNo: string;
  receiptHtml: string;
  totalAmount: number;
  paymentMethod: string;
  cashierName: string;
  branchName: string;
  itemsSummary: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("receipts").insert({
    sale_id: data.saleId,
    receipt_number: data.receiptNo,
    receipt_html: data.receiptHtml,
    total_amount: data.totalAmount,
    payment_method: data.paymentMethod,
    cashier_name: data.cashierName,
    branch_name: data.branchName,
    items_summary: data.itemsSummary,
  } as any);

  if (error) {
    console.error("[Receipts] Failed to save receipt:", error);
    return { error: error.message };
  }

  return { success: true };
}

// ---- Get all saved receipts ----

export type SavedReceipt = {
  id: string;
  sale_id: string;
  receipt_number: string;
  receipt_html: string;
  total_amount: number;
  payment_method: string;
  cashier_name: string | null;
  branch_name: string | null;
  items_summary: string | null;
  created_at: string;
};

export async function getReceipts(limit = 50) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) return [] as SavedReceipt[];

  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Receipts] Failed to fetch receipts:", error);
    return [] as SavedReceipt[];
  }

  return (data ?? []) as unknown as SavedReceipt[];
}

// ---- Get single receipt by ID ----

export async function getReceiptById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as SavedReceipt;
}

// ---- Get receipt by sale ID ----

export async function getReceiptBySaleId(saleId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("sale_id", saleId)
    .single();

  if (error) return null;
  return data as unknown as SavedReceipt;
}
