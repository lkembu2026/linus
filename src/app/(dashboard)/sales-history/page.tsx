import { getCurrentUser } from "@/actions/auth";
import { getRecentSales } from "@/actions/sales";
import { cookies } from "next/headers";
import {
  MODE_STORAGE_KEY,
  getCategoriesForMode,
  resolveCurrentBranchMode,
} from "@/lib/mode";
import { redirect } from "next/navigation";
import { SalesHistoryClient } from "./sales-history-client";

export default async function SalesHistoryPage() {
  const cookieStore = await cookies();
  const mode = await resolveCurrentBranchMode(
    cookieStore.get(MODE_STORAGE_KEY)?.value,
  );
  const categories = getCategoriesForMode(mode);

  const [user, sales] = await Promise.all([
    getCurrentUser(),
    getRecentSales(20, categories),
  ]);

  if (!user) redirect("/login");

  return <SalesHistoryClient sales={sales} userRole={user.role} />;
}
