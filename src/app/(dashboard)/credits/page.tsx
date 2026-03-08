import { getCurrentUser } from "@/actions/auth";
import { getCredits, getCreditStats } from "@/actions/credits";
import { cookies } from "next/headers";
import {
  MODE_STORAGE_KEY,
  getCategoriesForMode,
} from "@/lib/mode";
import { resolveCurrentBranchMode } from "@/lib/mode-server";
import { redirect } from "next/navigation";
import { CreditsClient } from "./credits-client";

export default async function CreditsPage() {
  const cookieStore = await cookies();
  const mode = await resolveCurrentBranchMode(
    cookieStore.get(MODE_STORAGE_KEY)?.value,
  );
  const categories = getCategoriesForMode(mode);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [credits, stats] = await Promise.all([
    getCredits("outstanding", categories),
    getCreditStats(categories),
  ]);

  return <CreditsClient credits={credits} stats={stats} userRole={user.role} />;
}
