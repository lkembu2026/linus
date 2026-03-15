import { getCurrentUser } from "@/actions/auth";
import { getImportInvoices } from "@/actions/invoices";
import { redirect } from "next/navigation";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["super_admin", "admin", "supervisor"].includes(user.role)) {
    redirect("/dashboard");
  }

  const { invoices, total } = await getImportInvoices();

  return <InvoicesClient initialInvoices={invoices} initialTotal={total} />;
}
