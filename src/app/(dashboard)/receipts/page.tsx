import { getCurrentUser } from "@/actions/auth";
import { getReceipts } from "@/actions/receipts";
import { cookies } from "next/headers";
import {
  MODE_STORAGE_KEY,
  getCategoriesForMode,
  normalizeMode,
} from "@/lib/mode";
import { redirect } from "next/navigation";
import { ReceiptsClient } from "./receipts-client";

export default async function ReceiptsPage() {
  const cookieStore = await cookies();
  const mode = normalizeMode(cookieStore.get(MODE_STORAGE_KEY)?.value);
  const categories = getCategoriesForMode(mode);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const receipts = await getReceipts(100, categories);

  return <ReceiptsClient receipts={receipts} />;
}
