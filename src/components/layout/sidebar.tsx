"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  Clock,
  CreditCard,
  Activity,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useEffect, useState } from "react";
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
  Clock,
  CreditCard,
  Activity,
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
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  // Clear spinner when navigation completes (pathname changes)
  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  // Use controlled state from parent if provided, otherwise use internal
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = (val: boolean) => {
    if (onCollapse) onCollapse(val);
    else setInternalCollapsed(val);
  };

  const filteredNavItems = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(userRole),
  );

  useEffect(() => {
    filteredNavItems.forEach((item) => {
      router.prefetch(item.href);
    });
    router.prefetch("/dashboard");
  }, [filteredNavItems, router]);

  function prefetchRoute(href: string) {
    router.prefetch(href);
  }

  return (
    <aside
      className={cn(
        "h-screen border-r border-border bg-[#0A0A0A] transition-all duration-300 flex flex-col",
        // Inside Sheet (mobile), use relative positioning and full width
        onNavigate ? "relative w-full" : "fixed left-0 top-0 z-40",
        !onNavigate && (collapsed ? "w-[72px]" : "w-64"),
      )}
    >
      {/* Logo + Collapse */}
      <div className="flex h-16 items-center border-b border-border px-3 gap-2">
        <Link
          href="/dashboard"
          onMouseEnter={() => prefetchRoute("/dashboard")}
          onFocus={() => prefetchRoute("/dashboard")}
          className={cn(
            "flex items-center gap-3 flex-1 min-w-0",
            collapsed && "justify-center",
          )}
        >
          <div className="shrink-0 rounded-full ring-2 ring-primary/50 ring-offset-2 ring-offset-[#0A0A0A] shadow-[0_0_12px_rgba(0,255,224,0.25)]">
            <Image
              src="/LKL.webp"
              alt="Linmaks PharmaCare"
              width={36}
              height={36}
              className="rounded-full"
            />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold font-[family-name:var(--font-sans)] text-white truncate">
              LK <span className="text-primary">PharmaCare</span>
            </span>
          )}
        </Link>
        {/* Collapse toggle — desktop only */}
        {!onNavigate && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-white transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
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
              onClick={(e) => {
                if (pathname !== item.href) {
                  setNavigatingTo(item.href);
                }
                // On mobile (Sheet), delay close so the spinner is visible briefly
                if (onNavigate) {
                  setTimeout(() => onNavigate(), 200);
                }
              }}
              onTouchStart={() => prefetchRoute(item.href)}
              onPointerDown={() => prefetchRoute(item.href)}
              onMouseEnter={() => prefetchRoute(item.href)}
              onFocus={() => prefetchRoute(item.href)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(0,255,224,0.1)]"
                  : "text-muted-foreground hover:bg-card hover:text-white",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? item.title : undefined}
            >
              {navigatingTo === item.href ? (
                <Loader2 className="h-5 w-5 shrink-0 text-primary animate-spin" />
              ) : (
                <Icon
                  className={cn("h-5 w-5 shrink-0", isActive && "text-primary")}
                />
              )}
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
      </div>
    </aside>
  );
}
