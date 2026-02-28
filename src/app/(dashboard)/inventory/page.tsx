import { getCurrentUser } from "@/actions/auth";
import { getMedicines } from "@/actions/inventory";
import { redirect } from "next/navigation";
import { InventoryClient } from "./inventory-client";

import { MEDICINE_CATEGORIES } from "@/lib/constants";

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Load pharmacy items by default; the client will re-fetch when mode hydrates from localStorage
  const medicines = await getMedicines(
    undefined,
    undefined,
    [...MEDICINE_CATEGORIES],
  );

  return <InventoryClient user={user} initialMedicines={medicines} />;
}
