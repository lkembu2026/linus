import { getCurrentUser } from "@/actions/auth";
import { getReceipts } from "@/actions/receipts";
import { MEDICINE_CATEGORIES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { ReceiptsClient } from "./receipts-client";

export default async function ReceiptsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const receipts = await getReceipts(100, [...MEDICINE_CATEGORIES]);

  return <ReceiptsClient receipts={receipts} />;
}
