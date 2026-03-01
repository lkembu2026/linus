import { getCurrentUser } from "@/actions/auth";
import { getCredits, getCreditStats } from "@/actions/credits";
import { MEDICINE_CATEGORIES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { CreditsClient } from "./credits-client";

export default async function CreditsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [credits, stats] = await Promise.all([
    getCredits("outstanding", [...MEDICINE_CATEGORIES]),
    getCreditStats([...MEDICINE_CATEGORIES]),
  ]);

  return <CreditsClient credits={credits} stats={stats} userRole={user.role} />;
}
