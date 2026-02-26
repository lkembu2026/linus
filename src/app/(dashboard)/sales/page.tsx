import { getCurrentUser } from "@/actions/auth";
import { getRecentSales } from "@/actions/sales";
import { redirect } from "next/navigation";
import { POSClient } from "./pos-client";

export default async function SalesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const recentSales = await getRecentSales();

  return <POSClient user={user} initialRecentSales={recentSales} />;
}
