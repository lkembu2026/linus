// =============================================
// LK PHARMACARE — SHARED APP TYPES
// =============================================

export type {
  Branch,
  User,
  Medicine,
  Sale,
  SaleItem,
  StockTransfer,
  AuditLog,
  Notification,
  UserRole,
  PaymentMethod,
  TransferStatus,
  SaleWithItems,
  AuditLogWithUser,
  Database,
} from "./database";

// ---- POS Cart Types ----
export interface CartItem {
  medicine_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  max_quantity: number; // available stock
}

// ---- Dashboard Stats ----
export interface DashboardStats {
  totalRevenueToday: number;
  totalRevenueMonth: number;
  salesCountToday: number;
  salesCountMonth: number;
  lowStockCount: number;
  totalMedicines: number;
}

export interface TopMedicine {
  medicine_id: string;
  medicine_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
}

export interface BranchComparison {
  branch_id: string;
  branch_name: string;
  revenue: number;
  sales_count: number;
}

// ---- Navigation ----
export interface NavItem {
  title: string;
  href: string;
  icon: string;
  roles: string[]; // which roles can see this
}

// ---- Offline Queue ----
export interface OfflineQueueItem {
  id: string;
  type: "sale" | "stock_adjustment";
  payload: Record<string, unknown>;
  created_at: string;
  synced: boolean;
}
