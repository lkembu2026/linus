import { getCurrentUser } from "@/actions/auth";
import { redirect } from "next/navigation";
import { POSClient } from "./pos-client";

export default async function SalesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <POSClient user={user} />;
}
