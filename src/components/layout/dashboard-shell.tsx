"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { IdleSessionManager } from "@/components/layout/idle-session-manager";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { startAutoSync } from "@/lib/offline/sync-queue";
import { NAV_ITEMS } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UserRole } from "@/types";

interface DashboardShellProps {
  children: React.ReactNode;
  userName: string;
  userRole: UserRole;
  branchName?: string;
  branchId?: string;
  branchSelection?: string;
}

export function DashboardShell({
  children,
  userName,
  userRole,
  branchName,
  branchId,
  branchSelection,
}: DashboardShellProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const allowedItems = NAV_ITEMS.filter((item) =>
      (item.roles as readonly string[]).includes(userRole),
    );

    for (const item of allowedItems) {
      router.prefetch(item.href);
    }

    router.prefetch("/dashboard");
  }, [router, userRole]);

  // Start auto-sync for offline sales when coming back online
  useEffect(() => {
    const cleanup = startAutoSync((result) => {
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} offline sale(s)`);
      }
      if (result.failed > 0) {
        toast.error(`Failed to sync ${result.failed} sale(s)`);
      }
    });
    return cleanup;
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <NavigationProgress />
      <IdleSessionManager />

      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar
          userRole={userRole}
          userName={userName}
          branchName={branchName}
          collapsed={collapsed}
          onCollapse={setCollapsed}
        />
      </div>

      {/* Mobile sidebar — sheet overlay */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-[#0A0A0A] border-r border-border data-[state=closed]:duration-200 data-[state=open]:duration-200"
        >
          <Sidebar
            userRole={userRole}
            userName={userName}
            branchName={branchName}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main content area — responsive padding that tracks collapse */}
      <div
        className={`transition-all duration-300 ${collapsed ? "md:pl-[72px]" : "md:pl-64"}`}
      >
        <Header
          userName={userName}
          userRole={userRole}
          branchName={branchName}
          branchId={branchId}
          branchSelection={branchSelection}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
