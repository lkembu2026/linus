# Implementation Plan

## Beauty & Clothing Module — Option A + Mode Toggle

**Version:** 1.0  
**Date:** February 28, 2026  
**Estimated Total Time:** 6–8 hours  
**Risk Level:** Low — no new tables required, no breaking changes

---

## Architecture Decision

Everything runs through the **existing `medicines` table** and all existing server actions. The mode toggle is a **pure UI/filter layer** — a React context that stores the current mode, gates which categories are shown, and adapts labels. The backend is completely unaware of "mode"; it just stores and returns products by category as always.

```
localStorage("lk-mode") = "pharmacy" | "beauty"
         ↓
  ModeContext (React context, wraps dashboard layout)
         ↓
  All pages read useMode() hook → filter/label accordingly
```

---

## Phase 1 — Foundation (Constants + Types + DB)

**Estimated time: 30 min**

### 1.1 — `src/lib/constants.ts`

- Add `BEAUTY_CATEGORIES` array with all 9 new categories
- Add `PHARMACY_CATEGORIES` alias pointing to existing `MEDICINE_CATEGORIES`
- Add `BEAUTY_SIZE_OPTIONS`, `BEAUTY_COLOUR_OPTIONS` suggestion arrays
- Add helper `PRODUCT_MODE_MAP`: category → mode lookup

### 1.2 — `src/types/index.ts`

- Add `export type AppMode = "pharmacy" | "beauty"`
- No other type changes required

### 1.3 — Supabase SQL (manual — user runs in Supabase dashboard)

```sql
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS brand  TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS size   TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS colour TEXT;
```

- Document SQL in `supabase/schema.sql` as well

---

## Phase 2 — Mode Context & Toggle Component

**Estimated time: 45 min**

### 2.1 — `src/contexts/mode-context.tsx` (NEW FILE)

- React context + provider: `ModeProvider`
- `useMode()` hook returns `{ mode, setMode, isPharmacy, isBeauty, modeCategories, modeLabel }`
- Persists to `localStorage("lk-pharmacare-mode")`
- Default: `"pharmacy"`
- `modeCategories`: returns correct category array for active mode
- `modeLabel`: `{ product: "Medicine"|"Product", inventory: "Inventory"|"Products", addButton: "Add Medicine"|"Add Product" }`

### 2.2 — `src/components/layout/mode-toggle.tsx` (NEW FILE)

- Two-button pill toggle: 💊 Pharmacy | 💄 Beauty & Clothing
- Reads/writes from `ModeContext`
- Active mode: teal background + text; inactive: muted
- Compact for header, responsive

### 2.3 — `src/app/(dashboard)/layout.tsx`

- Wrap layout with `<ModeProvider>`
- Add `<ModeToggle />` to the header area

---

## Phase 3 — Inventory Page Adaptation

**Estimated time: 1.5 hours**

### 3.1 — `src/app/(dashboard)/inventory/inventory-client.tsx`

- Import and use `useMode()` hook
- Category filter dropdown uses `modeCategories` (not the full list)
- Page title/header adapts via `modeLabel`
- Table columns in beauty mode: add Brand, Size, Colour; hide "Generic Name", "Dispensing Unit"
- Badge colours: beauty products get a rose/violet tint instead of teal
- "Add" button text from `modeLabel.addButton`
- `getMedicines()` call passes category filter list for current mode

### 3.2 — `src/actions/inventory.ts`

- Update `getMedicines(search?, category?, categoryList?)` signature
- When `categoryList` provided, filter `query.in("category", categoryList)`
- No other changes

### 3.3 — `src/components/inventory/medicine-form-dialog.tsx`

- Accept `mode: AppMode` prop (passed from inventory-client)
- In `"beauty"` mode:
  - Title: "Add Product" / "Edit Product"
  - Category dropdown uses `BEAUTY_CATEGORIES`
  - Show `brand`, `size`, `colour` fields (text inputs, all optional)
  - Hide `requires_prescription` toggle
  - Hide `dispensing_unit` field
  - `generic_name` label changed to "Variant / Notes"
- In `"pharmacy"` mode: no change from current behaviour
- Pass `brand`, `size`, `colour` through to `createMedicine` / `updateMedicine`

### 3.4 — `src/actions/inventory.ts`

- Add `brand?`, `size?`, `colour?` to `createMedicine` and `updateMedicine` type signatures
- Include in insert/update payload

---

## Phase 4 — POS Adaptation

**Estimated time: 45 min**

### 4.1 — `src/components/pos/medicine-search.tsx`

- Accept `mode: AppMode` prop
- Pass `mode` to `searchMedicines` action → filters by mode categories
- Search placeholder: "Search medicines…" | "Search products…"
- Add small "Search all" toggle button beneath search bar — when active, searches both modes
- Result card: show brand/size/colour under name for beauty items

### 4.2 — `src/actions/sales.ts` — `searchMedicines()`

- Add optional `categoryList?: string[]` parameter
- When provided, `.in("category", categoryList)` added to query
- Default (no param): searches all categories as today

### 4.3 — `src/app/(dashboard)/sales/pos-client.tsx`

- Import `useMode()`
- Pass `mode` down to `MedicineSearch`

---

## Phase 5 — Dashboard Mode Split

**Estimated time: 30 min**

### 5.1 — `src/actions/dashboard.ts`

- Update `getDashboardStats()` to also return:
  - `pharmacyRevenueToday: number`
  - `beautyRevenueToday: number`
  - `totalProductsBeauty: number`
- These are derived by joining sales → sale_items → medicines.category

### 5.2 — `src/components/dashboard/stats-cards.tsx`

- Add a mode split mini-card below existing stats (or replace "Total Medicines"):
  - 💊 Pharmacy revenue today | 💄 Beauty revenue today
  - Shown only if beauty revenue > 0 (graceful degradation)

---

## Phase 6 — Reports Mode Filter

**Estimated time: 30 min**

### 6.1 — `src/app/(dashboard)/reports/reports-client.tsx`

- Add mode filter to the existing filter bar (alongside date pickers)
- Options: All | Pharmacy Only | Beauty Only
- Passes mode category list to all `get*Report()` actions
- Filter already passes dates; extend to pass `categoryList`

### 6.2 — `src/actions/reports.ts`

- Add optional `categoryList?: string[]` to all report functions
- When provided, join through `sale_items → medicines` with `.in("medicines.category", categoryList)`

---

## Phase 7 — Analytics Mode Filter

**Estimated time: 30 min**

### 7.1 — `src/types/index.ts`

- Add `mode?: AppMode` to `AnalyticsFilters`

### 7.2 — `src/actions/analytics.ts`

- Add mode-based category filtering to all 4 analytics functions
- Same approach: `categoryList` from mode, passed to sale_items → medicines join

### 7.3 — `src/app/(dashboard)/analytics/analytics-client.tsx`

- Add mode buttons in filter bar alongside period and branch
- Options: All | 💊 Pharmacy | 💄 Beauty

---

## Phase 8 — CSV Import/Export

**Estimated time: 30 min**

### 8.1 — `src/components/inventory/import-medicines-dialog.tsx`

- Accept `mode: AppMode` prop
- Template download switches between pharmacy CSV template and beauty CSV template
- Beauty template includes: name, category (beauty only), brand, size, colour, unit_price, cost_price, quantity_in_stock, reorder_level, barcode

### 8.2 — Import action

- Map `brand`, `size`, `colour` from CSV columns when present

---

## Phase 9 — Polish & Commit

**Estimated time: 30 min**

### 9.1 — `supabase/schema.sql`

- Add the three `ALTER TABLE` statements as a comment block at the bottom

### 9.2 — Error check all modified files

- Run TypeScript check across all changed files
- Fix any type errors

### 9.3 — Commit

```
feat: beauty & clothing mode — categories, toggle, adapted inventory/POS/reports/analytics
```

---

## File Change Summary

| File                                                   | Change Type                                             |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `src/lib/constants.ts`                                 | MODIFY — add beauty categories + helpers                |
| `src/types/index.ts`                                   | MODIFY — add AppMode type                               |
| `src/contexts/mode-context.tsx`                        | **NEW**                                                 |
| `src/components/layout/mode-toggle.tsx`                | **NEW**                                                 |
| `src/app/(dashboard)/layout.tsx`                       | MODIFY — wrap ModeProvider, add toggle                  |
| `src/components/layout/header.tsx`                     | MODIFY — render ModeToggle                              |
| `src/actions/inventory.ts`                             | MODIFY — categoryList filter + brand/size/colour fields |
| `src/app/(dashboard)/inventory/inventory-client.tsx`   | MODIFY — mode-aware UI                                  |
| `src/components/inventory/medicine-form-dialog.tsx`    | MODIFY — adaptive fields                                |
| `src/actions/sales.ts`                                 | MODIFY — categoryList filter on searchMedicines         |
| `src/components/pos/medicine-search.tsx`               | MODIFY — mode prop + "search all" override              |
| `src/app/(dashboard)/sales/pos-client.tsx`             | MODIFY — pass mode to search                            |
| `src/actions/dashboard.ts`                             | MODIFY — pharmacy/beauty revenue split                  |
| `src/components/dashboard/stats-cards.tsx`             | MODIFY — mode split display                             |
| `src/app/(dashboard)/reports/reports-client.tsx`       | MODIFY — mode filter                                    |
| `src/actions/reports.ts`                               | MODIFY — categoryList filter                            |
| `src/types/index.ts` (analytics)                       | MODIFY — mode in AnalyticsFilters                       |
| `src/actions/analytics.ts`                             | MODIFY — mode filter                                    |
| `src/app/(dashboard)/analytics/analytics-client.tsx`   | MODIFY — mode toggle in filter bar                      |
| `src/components/inventory/import-medicines-dialog.tsx` | MODIFY — mode-aware template                            |
| `supabase/schema.sql`                                  | MODIFY — document ALTER TABLE statements                |

**Total: 5 new files, 16 file modifications**

---

## SQL to Run in Supabase (User Action Required)

```sql
-- Run in Supabase SQL Editor before or after deployment
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS brand  TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS size   TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS colour TEXT;
```

---

## Risks & Mitigations

| Risk                                                      | Likelihood | Mitigation                                               |
| --------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| Existing inventory items accidentally show in beauty mode | Low        | Category map is strict; "Other" stays in pharmacy        |
| POS sells beauty item in pharmacy mode                    | Low        | Mode filter is default; staff can override intentionally |
| Performance: category list filter on large inventory      | Very Low   | Supabase indexed on `category`; list filter is fast      |
| Staff switch modes accidentally                           | Low        | Toggle is deliberate 2-click action; session persists    |
| Breaking existing pharmacy workflow                       | Very Low   | All pharmacy code paths unchanged; new code additive     |

---

## Testing Checklist (Pre-Deploy)

- [ ] Switch to beauty mode → inventory shows only beauty categories
- [ ] Switch to pharmacy mode → inventory shows only pharmacy categories
- [ ] Add beauty product with brand/size/colour → saves correctly
- [ ] Add pharmacy medicine → prescription/generic fields work as before
- [ ] POS in beauty mode → search returns only beauty products
- [ ] POS "search all" → returns both
- [ ] Receipt includes beauty item correctly
- [ ] Reports mode filter → pharmacy/beauty revenue differs correctly
- [ ] Analytics mode filter works
- [ ] Low stock alert triggers for beauty product
- [ ] Mode persists after page navigation
- [ ] Mode resets to default correctly after localStorage clear
- [ ] No TypeScript errors
- [ ] Vercel build passes
