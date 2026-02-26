import { getCurrentUser } from "@/actions/auth";
import { getTransfers } from "@/actions/transfers";
import { getBranches } from "@/actions/branches";
import { redirect } from "next/navigation";
import { TransfersClient } from "./transfers-client";

export default async function TransfersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [transfers, branches] = await Promise.all([
    getTransfers(),
    user.role === "admin" ? getBranches() : Promise.resolve([]),
  ]);

  return (
    <TransfersClient user={user} transfers={transfers} branches={branches} />
  );
}
