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

// Visible roles for admin UI (super_admin is intentionally excluded)
export const VISIBLE_ROLES = ROLES;

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
    roles: ["super_admin", "admin"],
  },
  {
    title: "Users",
    href: "/users",
    icon: "Users",
    roles: ["super_admin", "admin"],
  },
  {
    title: "Transfers",
    href: "/transfers",
    icon: "ArrowLeftRight",
    roles: ["super_admin", "admin", "supervisor"],
  },
  {
    title: "Audit Log",
    href: "/audit",
    icon: "FileText",
    roles: ["super_admin", "admin"],
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
    roles: ["super_admin", "admin", "supervisor"],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: "Settings",
    roles: ["super_admin", "admin"],
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

// Beauty & clothing categories
export const BEAUTY_CATEGORIES = [
  "Hair Care",
  "Hair Accessories",
  "Perfumes & Fragrances",
  "Oils & Serums",
  "Skin Care",
  "Makeup",
  "Footwear",
  "Clothing & Apparel",
  "General Accessories",
] as const;

// Sizes for beauty/clothing products
export const BEAUTY_SIZE_OPTIONS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "One Size",
  "30ml",
  "50ml",
  "100ml",
  "200ml",
  "250ml",
  "500ml",
  "1L",
  "US 5",
  "US 6",
  "US 7",
  "US 8",
  "US 9",
  "US 10",
  "US 11",
  "US 12",
] as const;

// Common colours
export const BEAUTY_COLOUR_OPTIONS = [
  "Black",
  "White",
  "Brown",
  "Beige",
  "Red",
  "Pink",
  "Purple",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Gold",
  "Silver",
  "Clear / Transparent",
  "Multi-colour",
] as const;

// Which categories belong to which mode
export const PRODUCT_MODE_MAP: Record<string, "pharmacy" | "beauty"> = {
  Painkillers: "pharmacy",
  Antibiotics: "pharmacy",
  Antihistamines: "pharmacy",
  Antacids: "pharmacy",
  Antifungals: "pharmacy",
  Cardiovascular: "pharmacy",
  Diabetes: "pharmacy",
  Respiratory: "pharmacy",
  "Vitamins & Supplements": "pharmacy",
  Dermatology: "pharmacy",
  Gastrointestinal: "pharmacy",
  "Eye & Ear": "pharmacy",
  "Hair Care": "beauty",
  "Hair Accessories": "beauty",
  "Perfumes & Fragrances": "beauty",
  "Oils & Serums": "beauty",
  "Skin Care": "beauty",
  Makeup: "beauty",
  Footwear: "beauty",
  "Clothing & Apparel": "beauty",
  "General Accessories": "beauty",
};

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
