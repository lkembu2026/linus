import { getCurrentUser } from "@/actions/auth";
import { getBranches } from "@/actions/branches";
import { redirect } from "next/navigation";
import { BranchesClient } from "./branches-client";
import { isAdminRole } from "@/types";

export default async function BranchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminRole(user.role)) redirect("/dashboard");

  const branches = await getBranches();

  return <BranchesClient branches={branches} />;
}
