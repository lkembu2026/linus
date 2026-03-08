import { getCurrentUser } from "@/actions/auth";
import { getTransfers } from "@/actions/transfers";
import { getBranches } from "@/actions/branches";
import { cookies } from "next/headers";
import {
  MODE_STORAGE_KEY,
  getCategoriesForMode,
} from "@/lib/mode";
import { resolveCurrentBranchMode } from "@/lib/mode-server";
import { redirect } from "next/navigation";
import { TransfersClient } from "./transfers-client";

export default async function TransfersPage() {
  const cookieStore = await cookies();
  const mode = await resolveCurrentBranchMode(
    cookieStore.get(MODE_STORAGE_KEY)?.value,
  );
  const categories = getCategoriesForMode(mode);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [transfers, branches] = await Promise.all([
    getTransfers(categories),
    user.role === "admin" ? getBranches() : Promise.resolve([]),
  ]);

  return (
    <TransfersClient user={user} transfers={transfers} branches={branches} />
  );
}
