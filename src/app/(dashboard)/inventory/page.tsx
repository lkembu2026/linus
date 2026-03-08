import { getCurrentUser } from "@/actions/auth";
import { getMedicines } from "@/actions/inventory";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InventoryClient } from "./inventory-client";

import {
  MODE_STORAGE_KEY,
  getCategoriesForMode,
  resolveCurrentBranchMode,
} from "@/lib/mode";

export default async function InventoryPage() {
  const cookieStore = await cookies();
  const mode = await resolveCurrentBranchMode(
    cookieStore.get(MODE_STORAGE_KEY)?.value,
  );
  const categories = getCategoriesForMode(mode);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const medicines = await getMedicines(undefined, undefined, categories);

  return <InventoryClient user={user} initialMedicines={medicines} />;
}
