import type { UserRole } from "@/types";
import { isAdminRole } from "@/types";
export { isAdminRole };

export const PERMISSION_MAP = {
  view_dashboard: ["super_admin", "admin", "supervisor", "pharmacist", "cashier"],
  view_all_branches: ["super_admin", "admin"],
  create_sale: ["super_admin", "admin", "supervisor", "pharmacist", "cashier"],
  void_sale: ["super_admin", "admin"],
  view_inventory: ["super_admin", "admin", "supervisor", "pharmacist", "cashier"],
  add_medicine: ["super_admin", "admin", "pharmacist"],
  edit_medicine: ["super_admin", "admin", "pharmacist"],
  adjust_stock: ["super_admin", "admin", "pharmacist"],
  import_medicines: ["super_admin", "admin", "pharmacist"],
  bulk_opening_stock: ["super_admin", "admin"],
  sync_catalog: ["super_admin", "admin"],
  create_transfer: ["super_admin", "admin", "supervisor"],
  approve_transfer: ["super_admin", "admin"],
  manage_branches: ["super_admin", "admin"],
  manage_users: ["super_admin", "admin"],
  view_reports: ["super_admin", "admin", "supervisor", "pharmacist", "cashier"],
  save_reports: ["super_admin", "admin", "supervisor", "pharmacist", "cashier"],
  view_branch_comparison: ["super_admin", "admin"],
  view_analytics: ["super_admin", "admin", "supervisor"],
  view_audit_logs: ["super_admin", "admin"],
  manage_settings: ["super_admin", "admin"],
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
