# Role Matrix

This document defines the enforced role model for LK PharmaCare.

## Roles

| Role       | Scope           | Summary                                                                                    |
| ---------- | --------------- | ------------------------------------------------------------------------------------------ |
| admin      | All branches    | Full administrative control, multi-branch oversight, approvals, user and branch management |
| supervisor | Assigned branch | Operational management for branch sales, transfers, reporting, and analytics               |
| pharmacist | Assigned branch | Inventory and medicine management plus branch operations                                   |
| cashier    | Assigned branch | Sales, receipts, credits, inventory viewing, and branch reports                            |

## Page Access

| Page          | Admin | Supervisor | Pharmacist | Cashier |
| ------------- | ----- | ---------- | ---------- | ------- |
| Dashboard     | Yes   | Yes        | Yes        | Yes     |
| Point of Sale | Yes   | Yes        | Yes        | Yes     |
| Sales History | Yes   | Yes        | Yes        | Yes     |
| Credits       | Yes   | Yes        | Yes        | Yes     |
| Inventory     | Yes   | Yes        | Yes        | Yes     |
| Reports       | Yes   | Yes        | Yes        | Yes     |
| Receipts      | Yes   | Yes        | Yes        | Yes     |
| Transfers     | Yes   | Yes        | No         | No      |
| Analytics     | Yes   | Yes        | No         | No      |
| Branches      | Yes   | No         | No         | No      |
| Users         | Yes   | No         | No         | No      |
| Audit Log     | Yes   | No         | No         | No      |
| Settings      | Yes   | No         | No         | No      |

## Action Permissions

| Permission                    | Admin | Supervisor | Pharmacist | Cashier |
| ----------------------------- | ----- | ---------- | ---------- | ------- |
| View dashboard                | Yes   | Yes        | Yes        | Yes     |
| View all branches             | Yes   | No         | No         | No      |
| Create sale                   | Yes   | Yes        | Yes        | Yes     |
| Void sale                     | Yes   | No         | No         | No      |
| View inventory                | Yes   | Yes        | Yes        | Yes     |
| Add medicine or product       | Yes   | No         | Yes        | No      |
| Edit medicine or product      | Yes   | No         | Yes        | No      |
| Adjust stock                  | Yes   | No         | Yes        | No      |
| Import medicines or products  | Yes   | No         | Yes        | No      |
| Bulk set opening stock        | Yes   | No         | No         | No      |
| Sync catalog across branches  | Yes   | No         | No         | No      |
| Create transfer               | Yes   | Yes        | No         | No      |
| Approve or reject transfer    | Yes   | No         | No         | No      |
| Manage branches               | Yes   | No         | No         | No      |
| Manage users                  | Yes   | No         | No         | No      |
| View reports                  | Yes   | Yes        | Yes        | Yes     |
| Save reports                  | Yes   | Yes        | Yes        | Yes     |
| View branch comparison report | Yes   | No         | No         | No      |
| View analytics                | Yes   | Yes        | No         | No      |
| View audit logs               | Yes   | No         | No         | No      |
| Manage settings               | Yes   | No         | No         | No      |

## Branch Scope Rules

1. Admin can switch between branches and use all-branches views where supported.
2. Supervisor, pharmacist, and cashier are limited to their assigned branch.
3. Supervisors can create transfers only from their assigned branch.
4. Branch-level Pharmacy and Beauty mode settings are managed by admin and enforced per selected branch.

## Operational Notes

1. Sidebar visibility, middleware route protection, and server actions should all follow this matrix.
2. Admin-only destructive operations include deleting medicines, voiding sales, transfer approval or rejection, branch management, and user management.
