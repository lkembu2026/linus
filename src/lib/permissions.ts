import type { UserRole } from "@/types";

export const PERMISSION_MAP = {
  view_dashboard: ["admin", "supervisor", "pharmacist", "cashier"],
  view_all_branches: ["admin"],
  create_sale: ["admin", "supervisor", "pharmacist", "cashier"],
  void_sale: ["admin"],
  view_inventory: ["admin", "supervisor", "pharmacist", "cashier"],
  add_medicine: ["admin", "pharmacist"],
  edit_medicine: ["admin", "pharmacist"],
  adjust_stock: ["admin", "pharmacist"],
  import_medicines: ["admin", "pharmacist"],
  bulk_opening_stock: ["admin"],
  sync_catalog: ["admin"],
  create_transfer: ["admin", "supervisor"],
  approve_transfer: ["admin"],
  manage_branches: ["admin"],
  manage_users: ["admin"],
  view_reports: ["admin", "supervisor", "pharmacist", "cashier"],
  save_reports: ["admin", "supervisor", "pharmacist", "cashier"],
  view_branch_comparison: ["admin"],
  view_analytics: ["admin", "supervisor"],
  view_audit_logs: ["admin"],
  manage_settings: ["admin"],
} as const;

export type Permission = keyof typeof PERMISSION_MAP;

export function hasPermission(
  role: UserRole | undefined | null,
  permission: Permission,
): boolean {
  if (!role) return false;
  return (
    (PERMISSION_MAP[permission] as readonly string[]).includes(role) ?? false
  );
}
