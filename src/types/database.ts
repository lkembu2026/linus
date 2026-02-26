// =============================================
// LK PHARMACARE — DATABASE TYPES
// Matches Supabase PostgreSQL schema exactly
// Using `type` (not `interface`) so they satisfy
// Record<string, unknown> required by Supabase SDK.
// =============================================

export type UserRole = "admin" | "supervisor" | "pharmacist" | "cashier";
export type PaymentMethod = "cash" | "mpesa";
export type TransferStatus = "pending" | "approved" | "rejected";

// ---- BRANCHES ----
export type Branch = {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  created_at: string;
};

// ---- USERS ----
export type User = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
};

// ---- MEDICINES ----
export type Medicine = {
  id: string;
  name: string;
  generic_name: string | null;
  category: string;
  unit_price: number;
  cost_price: number;
  quantity_in_stock: number;
  reorder_level: number;
  expiry_date: string | null;
  barcode: string | null;
  requires_prescription: boolean;
  branch_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---- SALES ----
export type Sale = {
  id: string;
  receipt_number: string;
  total_amount: number;
  payment_method: string;
  cashier_id: string | null;
  branch_id: string;
  is_voided: boolean;
  voided_by: string | null;
  created_at: string;
};

// ---- SALE ITEMS ----
export type SaleItem = {
  id: string;
  sale_id: string;
  medicine_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
};

// ---- STOCK TRANSFERS ----
export type StockTransfer = {
  id: string;
  medicine_id: string;
  from_branch_id: string;
  to_branch_id: string;
  quantity: number;
  status: TransferStatus;
  requested_by: string | null;
  created_at: string;
};

// ---- AUDIT LOGS ----
export type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

// ---- NOTIFICATIONS ----
export type Notification = {
  id: string;
  user_id: string | null;
  branch_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

// =============================================
// JOIN / VIEW TYPES (for queries with relations)
// =============================================

export type SaleWithItems = Sale & {
  sale_items: (SaleItem & { medicine: Pick<Medicine, "name"> })[];
  cashier: Pick<User, "full_name"> | null;
};

export type AuditLogWithUser = AuditLog & {
  user: Pick<User, "full_name" | "email" | "role"> | null;
};

// =============================================
// SUPABASE DATABASE TYPE (for createClient)
// =============================================

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: Branch;
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: Partial<Branch>;
        Relationships: [];
      };
      users: {
        Row: User;
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: string;
          branch_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<User>;
        Relationships: [];
      };
      medicines: {
        Row: Medicine;
        Insert: {
          id?: string;
          name: string;
          generic_name?: string | null;
          category: string;
          unit_price?: number;
          cost_price?: number;
          quantity_in_stock?: number;
          reorder_level?: number;
          expiry_date?: string | null;
          barcode?: string | null;
          requires_prescription?: boolean;
          branch_id: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Medicine>;
        Relationships: [];
      };
      sales: {
        Row: Sale;
        Insert: {
          id?: string;
          receipt_number: string;
          total_amount: number;
          payment_method?: string;
          cashier_id?: string | null;
          branch_id: string;
          is_voided?: boolean;
          voided_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Sale>;
        Relationships: [];
      };
      sale_items: {
        Row: SaleItem;
        Insert: {
          id?: string;
          sale_id: string;
          medicine_id: string;
          quantity?: number;
          unit_price?: number;
          created_at?: string;
        };
        Update: Partial<SaleItem>;
        Relationships: [];
      };
      stock_transfers: {
        Row: StockTransfer;
        Insert: {
          id?: string;
          medicine_id: string;
          from_branch_id: string;
          to_branch_id: string;
          quantity?: number;
          status?: string;
          requested_by?: string | null;
          created_at?: string;
        };
        Update: Partial<StockTransfer>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          details?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<AuditLog>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: {
          id?: string;
          user_id?: string | null;
          branch_id?: string | null;
          title: string;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Notification>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
