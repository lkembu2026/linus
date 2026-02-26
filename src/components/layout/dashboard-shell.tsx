"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { UserRole } from "@/types";

interface DashboardShellProps {
  children: React.ReactNode;
  userName: string;
  userRole: UserRole;
  branchName?: string;
}

export function DashboardShell({
  children,
  userName,
  userRole,
  branchName,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        userRole={userRole}
        userName={userName}
        branchName={branchName}
      />
      <div className="pl-64 transition-all duration-300">
        <Header
          userName={userName}
          userRole={userRole}
          branchName={branchName}
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
