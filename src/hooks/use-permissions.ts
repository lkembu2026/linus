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

  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isPharmacist = role === "pharmacist";
  const isCashier = role === "cashier";

  return { can, isAdmin, isSupervisor, isPharmacist, isCashier };
}
