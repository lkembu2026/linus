# LK PharmaCare Changelog

## 2026-03-01 — Admin Branch Switcher + All Branches Scope

### Summary
- Added an admin branch selector in the top header so admins can switch operational context without logging out.
- Added an explicit `All Branches` option as the default admin scope.
- Wired server-side branch scoping so dashboard and operational pages follow the selected branch context.

### Behavior
- Admin users now see a `Branch` dropdown in the header.
- Selecting a branch updates the branch cookie and refreshes the app state.
- Selecting `All Branches` clears branch-level scoping for admin queries.
- Non-admin users continue to be scoped to their assigned `branch_id`.

### Technical Notes
- New shared branch context helper:
  - `src/lib/branch.ts`
- Updated layout and shell wiring:
  - `src/app/(dashboard)/layout.tsx`
  - `src/components/layout/dashboard-shell.tsx`
  - `src/components/layout/header.tsx`
- Updated branch-aware server actions:
  - `src/actions/dashboard.ts`
  - `src/actions/inventory.ts`
  - `src/actions/sales.ts`
  - `src/actions/credits.ts`
  - `src/actions/receipts.ts`
  - `src/actions/transfers.ts`

### Outcome
- Admin branch switching is fully functional across dashboard navigation and key operational modules.
- Branch context is consistent between server render and client interactions.
