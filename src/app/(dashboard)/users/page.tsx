import { getCurrentUser } from "@/actions/auth";
import { getUsers } from "@/actions/users";
import { getBranches } from "@/actions/branches";
import { redirect } from "next/navigation";
import { UsersClient } from "./users-client";

import { isAdminRole } from "@/lib/permissions";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminRole(user.role)) redirect("/dashboard");

  const [users, branches] = await Promise.all([getUsers(), getBranches()]);

  return (
    <UsersClient users={users} branches={branches} currentUserId={user.id} />
  );
}
