"use client";

import { useMemo } from "react";
import type { UserRole } from "@/types";

const PERMISSION_MAP = {
  view_dashboard: ["admin", "supervisor", "pharmacist", "cashier"],
  view_all_branches: ["admin"],
  create_sale: ["admin", "supervisor", "pharmacist", "cashier"],
  edit_sale: ["admin"],
  add_medicine: ["admin", "supervisor"],
  edit_medicine: ["admin"],
  adjust_stock: ["admin"],
  view_inventory: ["admin", "supervisor", "pharmacist", "cashier"],
  create_transfer: ["admin", "supervisor"],
  approve_transfer: ["admin"],
  add_branch: ["admin"],
  add_user: ["admin"],
  view_all_reports: ["admin"],
  view_branch_reports: ["admin", "supervisor", "pharmacist", "cashier"],
  view_audit_logs: ["admin"],
  manage_settings: ["admin"],
} as const;

type Permission = keyof typeof PERMISSION_MAP;

export function usePermissions(role: UserRole | undefined) {
  const can = useMemo(() => {
    return (permission: Permission): boolean => {
      if (!role) return false;
      return (
        (PERMISSION_MAP[permission] as readonly string[])?.includes(role) ??
        false
      );
    };
  }, [role]);

  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isPharmacist = role === "pharmacist";
  const isCashier = role === "cashier";

  return { can, isAdmin, isSupervisor, isPharmacist, isCashier };
}
