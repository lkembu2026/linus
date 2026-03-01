import { getCurrentUser } from "@/actions/auth";
import { getRecentSales } from "@/actions/sales";
import { MEDICINE_CATEGORIES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { SalesHistoryClient } from "./sales-history-client";

export default async function SalesHistoryPage() {
  const [user, sales] = await Promise.all([
    getCurrentUser(),
    getRecentSales(20, [...MEDICINE_CATEGORIES]),
  ]);

  if (!user) redirect("/login");

  return <SalesHistoryClient sales={sales} userRole={user.role} />;
}
