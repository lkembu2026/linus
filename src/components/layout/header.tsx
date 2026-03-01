"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { logout } from "@/actions/auth";
import { getBranches } from "@/actions/branches";
import {
  getNotifications,
  markNotificationRead,
  markAllRead,
  type Notification,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  LogOut,
  Menu,
  User,
  Wifi,
  WifiOff,
  CheckCheck,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { ModeToggle } from "@/components/layout/mode-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIVE_BRANCH_COOKIE, ALL_BRANCHES_VALUE } from "@/lib/branch";
import type { UserRole } from "@/types";

interface HeaderProps {
  userName: string;
  userRole: UserRole;
  branchName?: string;
  branchId?: string;
  branchSelection?: string;
  onMenuClick?: () => void;
}

export function Header({
  userName,
  userRole,
  branchName,
  branchId,
  branchSelection,
  onMenuClick,
}: HeaderProps) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [activeBranchId, setActiveBranchId] = useState(
    branchSelection ?? branchId ?? ALL_BRANCHES_VALUE,
  );

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    setActiveBranchId(branchSelection ?? branchId ?? ALL_BRANCHES_VALUE);
  }, [branchSelection, branchId]);

  useEffect(() => {
    if (userRole !== "admin") return;

    let isMounted = true;

    (async () => {
      const data = await getBranches();
      if (!isMounted) return;

      const branchOptions = (data ?? []).map((branch) => ({
        id: branch.id,
        name: branch.name,
      }));

      setBranches(branchOptions);
    })();

    return () => {
      isMounted = false;
    };
  }, [userRole]);

  function handleBranchChange(nextBranchId: string) {
    setActiveBranchId(nextBranchId);
    document.cookie = `${ACTIVE_BRANCH_COOKIE}=${nextBranchId}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function handleMarkAllRead() {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  const notifIcon = (type: string) => {
    switch (type) {
      case "warning":
        return (
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
        );
      case "success":
        return <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
      default:
        return <Info className="h-3.5 w-3.5 text-primary shrink-0" />;
    }
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-[#0A0A0A]/95 backdrop-blur-sm px-4 md:px-6">
      {/* Left: Hamburger + Page context */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground hover:text-white"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {userRole === "admin" && branches.length > 0 ? (
          <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg bg-card border border-border">
            <span className="text-xs text-muted-foreground">Branch:</span>
            <Select value={activeBranchId} onValueChange={handleBranchChange}>
              <SelectTrigger className="h-7 min-w-[170px] border-0 bg-transparent px-2 text-xs">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_BRANCHES_VALUE}>All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          branchName && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <span className="text-xs text-muted-foreground">Branch:</span>
            <span className="text-xs font-medium text-primary">
              {branchName}
            </span>
          </div>
          )
        )}

        {/* Mode toggle — Pharmacy / Beauty */}
        <div className="hidden sm:block">
          <ModeToggle />
        </div>
      </div>

      {/* Right: Status + Notifications + Profile */}
      <div className="flex items-center gap-3">
        {/* Online/Offline indicator */}
        <div className={isOnline ? "status-online" : "status-offline"}>
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-white"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 bg-card border-border p-0"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary text-xs h-auto py-1 px-2"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-72">
              {notifications.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No notifications
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-background/50 cursor-pointer ${!n.is_read ? "bg-primary/5" : ""}`}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                  >
                    {notifIcon(n.type)}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs leading-tight ${!n.is_read ? "text-white font-medium" : "text-muted-foreground"}`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {n.message}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8 border border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">{userName}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {userRole}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-card border-border"
          >
            <DropdownMenuItem className="text-muted-foreground focus:text-white">
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
