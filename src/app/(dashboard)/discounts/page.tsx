import { getCurrentUser } from "@/actions/auth";
import { redirect } from "next/navigation";
import { isAdminRole } from "@/types";
import { getDiscountedSales } from "@/actions/discounts";
import { DiscountsClient } from "./discounts-client";

export default async function DiscountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminRole(user.role) && user.role !== "supervisor")
    redirect("/dashboard");

  const { items, total } = await getDiscountedSales();

  return <DiscountsClient initialItems={items} initialTotal={total} />;
}
