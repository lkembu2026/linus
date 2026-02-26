import { getCurrentUser } from "@/actions/auth";
import { getMedicines } from "@/actions/inventory";
import { redirect } from "next/navigation";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const medicines = await getMedicines();

  return <InventoryClient user={user} initialMedicines={medicines} />;
}
