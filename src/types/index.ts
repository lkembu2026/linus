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
  AppMode,
  SaleWithItems,
  AuditLogWithUser,
  ReportSettings,
  Database,
} from "./database";

// ---- POS Cart Types ----
export interface CartItem {
  medicine_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  max_quantity: number; // available stock
  dispensing_unit?: string | null;
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

export interface MedicineAddedPoint {
  date: string;
  count: number;
}

export interface MedicineDailySales {
  date: string;
  units_sold: number;
}

export interface MedicineCategoryBreakdown {
  category: string;
  units_sold: number;
  remaining_stock: number;
}

export interface InventoryOverview {
  total: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  recently_added: MedicineAddedPoint[];
}

// ---- Analytics ----
export type AnalyticsPeriod =
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "custom";

export interface AnalyticsFilters {
  period: AnalyticsPeriod;
  dateFrom: string;
  dateTo: string;
  branchId?: string;
}

export interface AnalyticsOverview {
  totalRevenue: number;
  totalSales: number;
  avgOrderValue: number;
  totalUnitsSold: number;
  totalProfit: number;
  profitMargin: number;
  revenueByDay: { date: string; revenue: number; profit: number }[];
}

export interface SalesBreakdown {
  byPaymentMethod: { method: string; count: number; amount: number }[];
  byHour: { hour: string; count: number; amount: number }[];
  byDayOfWeek: { day: string; count: number; amount: number }[];
  byCashier: { name: string; count: number; amount: number }[];
}

export interface InventoryHealth {
  totalStockValue: number;
  totalCostValue: number;
  potentialProfit: number;
  totalUnits: number;
  categorySummary: {
    category: string;
    units: number;
    value: number;
    cost: number;
  }[];
  nearExpiry: {
    name: string;
    expiry_date: string;
    quantity_in_stock: number;
    category: string;
  }[];
}

export interface MedicinePerformance {
  topSellers: {
    name: string;
    category: string;
    units_sold: number;
    revenue: number;
  }[];
  slowMovers: {
    name: string;
    category: string;
    quantity_in_stock: number;
  }[];
  categoryPerformance: {
    category: string;
    units_sold: number;
    revenue: number;
  }[];
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
