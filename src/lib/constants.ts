// =============================================
// LK PHARMACARE — APP CONSTANTS
// =============================================

export const APP_NAME = "LK PharmaCare";
export const APP_DESCRIPTION =
  "Multi-Branch, Offline-First Pharmacy Operating System";
export const APP_VERSION = "1.0.0";

// Roles
export const ROLES = {
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  PHARMACIST: "pharmacist",
  CASHIER: "cashier",
} as const;

// Navigation items with role-based access
export const NAV_ITEMS = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    roles: ["admin", "supervisor", "pharmacist", "cashier"],
  },
  {
    title: "Point of Sale",
    href: "/sales",
    icon: "ShoppingCart",
    roles: ["admin", "supervisor", "pharmacist", "cashier"],
  },
  {
    title: "Sales History",
    href: "/sales-history",
    icon: "Clock",
    roles: ["admin", "supervisor", "pharmacist", "cashier"],
  },
  {
    title: "Credits",
    href: "/credits",
    icon: "CreditCard",
    roles: ["admin", "supervisor", "pharmacist", "cashier"],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: "Package",
    roles: ["admin", "supervisor", "pharmacist", "cashier"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: "BarChart3",
    roles: ["admin", "supervisor", "pharmacist", "cashier"],
  },
  {
    title: "Branches",
    href: "/branches",
    icon: "Building2",
    roles: ["admin"],
  },
  {
    title: "Users",
    href: "/users",
    icon: "Users",
    roles: ["admin"],
  },
  {
    title: "Transfers",
    href: "/transfers",
    icon: "ArrowLeftRight",
    roles: ["admin", "supervisor"],
  },
  {
    title: "Audit Log",
    href: "/audit",
    icon: "FileText",
    roles: ["admin"],
  },
  {
    title: "Receipts",
    href: "/receipts",
    icon: "Receipt",
    roles: ["admin", "supervisor", "pharmacist", "cashier"],
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: "Activity",
    roles: ["admin", "supervisor"],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: "Settings",
    roles: ["admin"],
  },
] as const;

// Medicine categories
export const MEDICINE_CATEGORIES = [
  "Painkillers",
  "Antibiotics",
  "Antihistamines",
  "Antacids",
  "Antifungals",
  "Cardiovascular",
  "Diabetes",
  "Respiratory",
  "Vitamins & Supplements",
  "Dermatology",
  "Gastrointestinal",
  "Eye & Ear",
  "Other",
] as const;

// Dispensing units for loose medicine
export const DISPENSING_UNITS = [
  "Tablet",
  "Capsule",
  "Sachet",
  "Strip",
  "Bottle",
  "Vial",
  "Ampoule",
  "Tube",
  "ml",
  "g",
  "Box",
  "Piece",
] as const;

// Payment methods
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "credit", label: "Credit" },
] as const;

// Default low stock threshold
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
