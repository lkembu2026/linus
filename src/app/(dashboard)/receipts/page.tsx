import { getCurrentUser } from "@/actions/auth";
import { getReceipts } from "@/actions/receipts";
import { redirect } from "next/navigation";
import { ReceiptsClient } from "./receipts-client";

export default async function ReceiptsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const receipts = await getReceipts(100);

  return <ReceiptsClient receipts={receipts} />;
}
