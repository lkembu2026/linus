# Product Requirements Document

## LK PharmaCare — Beauty & Clothing Module (Option A + Mode Toggle)

**Version:** 1.0  
**Date:** February 28, 2026  
**Status:** Approved for Implementation

---

## 1. Background & Problem Statement

The client operates a pharmacy that also sells beauty products (hair care, perfumes, oils, accessories) and footwear (slippers, shoes). Currently these products are sold with **no system tracking** — no stock counts, no revenue recording, no reorder alerts, no sales history.

This causes:

- Unknown stock levels → over-ordering or stockouts
- Revenue from non-pharmacy sales not captured in reports
- Staff manually keeping paper records (error-prone)
- No way to identify which beauty/clothing items sell best

The existing LK PharmaCare system handles all pharmacy needs. This PRD defines the extension to cover beauty & clothing within the **same system**, with a **mode toggle** that gives each side a clean, focused interface.

---

## 2. Goals

| Goal                                | Success Metric                                             |
| ----------------------------------- | ---------------------------------------------------------- |
| Track beauty & clothing stock       | 100% of beauty/clothing items in inventory                 |
| Sell beauty/clothing through POS    | Receipts include beauty items alongside medicines          |
| Separate staff UX per business side | Mode toggle persists per user session                      |
| No disruption to pharmacy workflow  | Pharmacists never see beauty categories unless they switch |
| Reports reflect both sides          | Revenue, stock, analytics filterable by mode               |

---

## 3. Non-Goals (Out of Scope)

- A separate database or backend — everything stays in the same `medicines` table
- Barcode label printing changes — existing system works for both
- User role changes — same roles apply to both modes
- E-commerce / customer-facing portal
- Full variant management (size trees, colour matrices) — handled manually via naming

---

## 4. Users & Personas

| Persona                      | Mode Usage                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| **Pharmacist**               | Stays in Pharmacy mode by default; should never accidentally add slippers to drug inventory |
| **Cashier (beauty counter)** | Switches to Beauty mode; sells hair products and shoes without seeing drug lists            |
| **Admin/Supervisor**         | Uses both modes freely; sees combined analytics and per-mode reports                        |
| **Stock Manager**            | Switches modes to do stock counts on each side independently                                |

---

## 5. User Stories

### 5.1 Mode Toggle

- As a **cashier**, I want to switch from Pharmacy to Beauty mode so that the POS only shows beauty products
- As an **admin**, I want the system to remember my last mode across page navigation so I don't keep switching
- As a **pharmacist**, I want Pharmacy mode to be the default on login so I never accidentally land on beauty inventory

### 5.2 Inventory

- As an **admin**, I want to add a hair band with optional `brand`, `size`, and `colour` fields that medicines don't have
- As a **stock manager**, I want beauty/clothing items to show low stock alerts just like medicines
- As an **admin**, I want to bulk-import beauty products via CSV, same as medicines
- As a **pharmacist**, I want inventory search to only return pharmacy products when I'm in Pharmacy mode

### 5.3 Point of Sale

- As a **cashier in beauty mode**, I want the product search bar to only return beauty & clothing items
- As a **cashier**, I want to be able to sell a mix of pharmacy + beauty items in one transaction by temporarily searching across both
- As an **admin**, I want receipts to clearly show which items are pharmacy vs beauty

### 5.4 Reports & Analytics

- As an **admin**, I want to filter all reports by mode (Pharmacy / Beauty / All) to understand each business side
- As an **admin**, I want the dashboard to show a revenue split between pharmacy and beauty sales
- As a **supervisor**, I want the analytics page to be filterable by mode, same as by branch

### 5.5 Product Form

- As an **admin in beauty mode**, I want to add a product with `brand`, `size`, `colour` fields visible
- As an **admin in beauty mode**, I want `requires_prescription` hidden since it doesn't apply
- As an **admin in beauty mode**, I want the form title to say "Add Product" not "Add Medicine"

---

## 6. Product Categories

### Pharmacy Categories (existing — unchanged)

Painkillers, Antibiotics, Antihistamines, Antacids, Antifungals, Cardiovascular, Diabetes, Respiratory, Vitamins & Supplements, Dermatology, Gastrointestinal, Eye & Ear, Other

### Beauty & Clothing Categories (new)

| Category              | Example Products                                    |
| --------------------- | --------------------------------------------------- |
| Hair Care             | Shampoo, conditioner, hair cream, relaxers          |
| Hair Accessories      | Hair bands, clips, pins, wigs, weaves               |
| Perfumes & Fragrances | Body sprays, perfumes, roll-ons                     |
| Oils & Serums         | Coconut oil, castor oil, argan oil, skincare serums |
| Skin Care             | Lotions, body butter, sunscreen, face wash          |
| Makeup                | Foundation, lipstick, mascara, nail polish          |
| Footwear              | Slippers, sandals, shoes, sneakers                  |
| Clothing & Apparel    | T-shirts, socks, underwear, vests                   |
| General Accessories   | Bags, belts, wallets, sunglasses                    |

---

## 7. New Fields for Beauty & Clothing Products

These are **optional fields** stored as existing or new columns on the `medicines` table:

| Field    | Type            | Applies To                  | Example                 |
| -------- | --------------- | --------------------------- | ----------------------- |
| `brand`  | TEXT (nullable) | Beauty & Clothing primarily | "Nivea", "Nike", "Dove" |
| `size`   | TEXT (nullable) | Footwear, Clothing          | "Size 7", "XL", "200ml" |
| `colour` | TEXT (nullable) | Clothing, some accessories  | "Black", "Red"          |

These fields are already addable to the existing schema as nullable columns. They are shown in the inventory form when in Beauty mode, hidden in Pharmacy mode.

---

## 8. Mode Toggle Design

### Toggle Appearance

```
┌─────────────────────────────────────────┐
│  💊 Pharmacy    │    💄 Beauty & Clothing │
└─────────────────────────────────────────┘
```

- Located in the **header** (top bar), visible on every page
- Active mode shown with teal highlight, inactive dimmed
- Persisted in **localStorage** (survives page navigation, lost on logout)
- Default on first load: **Pharmacy**

### Mode Label Adaptations

| UI Element            | Pharmacy Mode         | Beauty Mode          |
| --------------------- | --------------------- | -------------------- |
| Inventory page title  | "Inventory"           | "Products"           |
| Add button            | "Add Medicine"        | "Add Product"        |
| Search placeholder    | "Search medicines…"   | "Search products…"   |
| Empty state           | "No medicines found"  | "No products found"  |
| Low stock alert label | "Low stock medicines" | "Low stock products" |
| Form title            | "Add Medicine"        | "Add Product"        |

---

## 9. Impact on Existing Features

| Feature           | Change                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| Inventory page    | Filters by mode categories; shows brand/size/colour columns in beauty mode |
| POS search        | Filters to mode categories by default; "Search all" override button        |
| Dashboard stats   | "Total Medicines" card label adapts; adds mode revenue split               |
| Reports           | Mode filter added to all report types                                      |
| Analytics         | Mode filter added alongside period and branch                              |
| Low stock alerts  | Triggered for all products regardless of mode                              |
| CSV import/export | Mode determines which category template is downloaded                      |
| Barcode labels    | No change — works for both                                                 |
| Receipts          | Items shown as-is; no mode-specific receipt changes                        |
| Audit log         | No change                                                                  |
| Transfers         | Works for beauty products same as medicines                                |

---

## 10. Data Model Changes

No new tables required. The following SQL alters are needed on the existing `medicines` table:

```sql
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS size   TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS colour TEXT;
```

The `category` field already exists and will be used to determine which mode a product belongs to. A product's mode is derived from its category:

- If category ∈ PHARMACY_CATEGORIES → Pharmacy mode
- If category ∈ BEAUTY_CATEGORIES → Beauty & Clothing mode

---

## 11. Acceptance Criteria

- [ ] Mode toggle visible on all dashboard pages (header)
- [ ] Switching mode persists across navigation within session
- [ ] Pharmacy mode default on first load / fresh session
- [ ] Inventory filtered correctly by mode (no cross-contamination)
- [ ] Add form adapts fields based on mode (brand/size/colour shown; prescription hidden in beauty)
- [ ] POS search defaults to mode categories, has "all" override
- [ ] Reports have functioning mode filter
- [ ] Analytics has functioning mode filter
- [ ] Dashboard shows split: pharmacy revenue vs beauty revenue today
- [ ] Low stock alerts work for beauty products
- [ ] CSV import/export works for beauty products
- [ ] All existing pharmacy functionality unaffected

---

## 12. Open Questions

| Question                                         | Decision                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| Should cashiers be able to switch modes?         | Yes — anyone can switch. Mode is just a UI filter, not a permission |
| Should one sale mix pharmacy + beauty?           | Yes — cart accepts items from both modes                            |
| What happens to existing "Other" category items? | They stay in Pharmacy mode under "Other"                            |
| Should branch-specific users see the toggle?     | Yes — beauty/clothing may exist in any branch                       |
