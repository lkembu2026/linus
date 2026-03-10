"use client";

import { useMemo } from "react";
import type { UserRole } from "@/types";
import { hasPermission, type Permission } from "@/lib/permissions";

export function usePermissions(role: UserRole | undefined) {
  const can = useMemo(() => {
    return (permission: Permission): boolean => {
      return hasPermission(role, permission);
    };
  }, [role]);

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin" || role === "super_admin";
  const isSupervisor = role === "supervisor";
  const isPharmacist = role === "pharmacist";
  const isCashier = role === "cashier";

  return { can, isSuperAdmin, isAdmin, isSupervisor, isPharmacist, isCashier };
}
