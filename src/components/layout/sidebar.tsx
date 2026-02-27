"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Building2,
  Users,
  ArrowLeftRight,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useState } from "react";
import type { UserRole } from "@/types";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Building2,
  Users,
  ArrowLeftRight,
  FileText,
  Settings,
  Receipt,
};

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  branchName?: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

export function Sidebar({
  userRole,
  userName,
  branchName,
  onNavigate,
  collapsed: controlledCollapsed,
  onCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Use controlled state from parent if provided, otherwise use internal
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = (val: boolean) => {
    if (onCollapse) onCollapse(val);
    else setInternalCollapsed(val);
  };

  const filteredNavItems = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(userRole),
  );

  return (
    <aside
      className={cn(
        "h-screen border-r border-border bg-[#0A0A0A] transition-all duration-300 flex flex-col",
        // Inside Sheet (mobile), use relative positioning and full width
        onNavigate ? "relative w-full" : "fixed left-0 top-0 z-40",
        !onNavigate && (collapsed ? "w-[72px]" : "w-64"),
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/lk1.webp"
            alt="LK PharmaCare"
            width={36}
            height={36}
            className="shrink-0 rounded-lg"
          />
          {!collapsed && (
            <div>
              <span className="text-sm font-bold font-[family-name:var(--font-sans)] text-white">
                LK <span className="text-primary">PharmaCare</span>
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {filteredNavItems.map((item) => {
          const Icon = iconMap[item.icon] || LayoutDashboard;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(0,255,224,0.1)]"
                  : "text-muted-foreground hover:bg-card hover:text-white",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? item.title : undefined}
            >
              <Icon
                className={cn("h-5 w-5 shrink-0", isActive && "text-primary")}
              />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-border p-4">
        {(!collapsed || onNavigate) && (
          <div className="mb-3">
            <p className="text-sm font-medium text-white truncate">
              {userName}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {userRole}
            </p>
            {branchName && (
              <p className="text-xs text-primary/70 truncate">{branchName}</p>
            )}
          </div>
        )}
        {/* Hide collapse toggle on mobile */}
        {!onNavigate && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-white transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
