import { getCurrentUser } from "@/actions/auth";
import { redirect } from "next/navigation";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ReportsClient user={user} />;
}
