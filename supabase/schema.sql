-- ========================================================
-- LK PharmaCare — Database Schema
-- Run this in Supabase SQL Editor to set up all tables
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- 1. BRANCHES
-- --------------------------------------------------------
CREATE TABLE branches (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  location   TEXT,
  phone      TEXT,
  enable_pharmacy BOOLEAN NOT NULL DEFAULT true,
  enable_beauty   BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE branches
  ADD CONSTRAINT branches_at_least_one_mode
  CHECK (enable_pharmacy OR enable_beauty);

-- --------------------------------------------------------
-- 2. USERS (extends Supabase auth.users)
-- --------------------------------------------------------
CREATE TABLE users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','supervisor','pharmacist','cashier')),
  branch_id  UUID REFERENCES branches(id),
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 3. MEDICINES
-- --------------------------------------------------------
CREATE TABLE medicines (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  generic_name          TEXT,
  category              TEXT NOT NULL,
  unit_price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity_in_stock     INT NOT NULL DEFAULT 0,
  reorder_level         INT NOT NULL DEFAULT 10,
  expiry_date           DATE,
  barcode               TEXT,
  dispensing_unit       TEXT,
  requires_prescription BOOLEAN DEFAULT false,
  -- Beauty & Clothing fields (nullable — only used in beauty mode)
  brand                 TEXT,
  size                  TEXT,
  colour                TEXT,
  branch_id             UUID NOT NULL REFERENCES branches(id),
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_medicines_branch ON medicines(branch_id);
CREATE INDEX idx_medicines_name   ON medicines USING gin (to_tsvector('english', name));

-- --------------------------------------------------------
-- 4. SALES
-- --------------------------------------------------------
CREATE TABLE sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number  TEXT NOT NULL UNIQUE,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'cash',
  cashier_id      UUID REFERENCES users(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  is_voided       BOOLEAN DEFAULT false,
  voided_by       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_branch    ON sales(branch_id);
CREATE INDEX idx_sales_cashier   ON sales(cashier_id);
CREATE INDEX idx_sales_date      ON sales(created_at);

-- --------------------------------------------------------
-- 5. SALE ITEMS
-- --------------------------------------------------------
CREATE TABLE sale_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id      UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  medicine_id  UUID NOT NULL REFERENCES medicines(id),
  quantity     INT NOT NULL DEFAULT 1,
  unit_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);

-- --------------------------------------------------------
-- 6. STOCK TRANSFERS
-- --------------------------------------------------------
CREATE TABLE stock_transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id     UUID NOT NULL REFERENCES medicines(id),
  from_branch_id  UUID NOT NULL REFERENCES branches(id),
  to_branch_id    UUID NOT NULL REFERENCES branches(id),
  quantity        INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 7. AUDIT LOGS
-- --------------------------------------------------------
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id),
  action     TEXT NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);

-- --------------------------------------------------------
-- 8. NOTIFICATIONS
-- --------------------------------------------------------
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id),
  branch_id  UUID REFERENCES branches(id),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Auto-update updated_at trigger for medicines
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medicines_updated_at
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================================

-- Enable RLS on all tables
ALTER TABLE branches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's branch
CREATE OR REPLACE FUNCTION get_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- BRANCHES: all authenticated can read, only admin can write
CREATE POLICY "branches_select" ON branches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "branches_admin_insert" ON branches
  FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "branches_admin_update" ON branches
  FOR UPDATE TO authenticated USING (get_user_role() = 'admin');

CREATE POLICY "branches_admin_delete" ON branches
  FOR DELETE TO authenticated USING (get_user_role() = 'admin');

-- USERS: all authenticated can read, only admin can write
CREATE POLICY "users_select" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "users_admin_insert" ON users
  FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "users_admin_update" ON users
  FOR UPDATE TO authenticated USING (get_user_role() = 'admin' OR id = auth.uid());

-- MEDICINES: admin sees all, others see own branch
CREATE POLICY "medicines_select" ON medicines
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR branch_id = get_user_branch_id()
  );

CREATE POLICY "medicines_insert" ON medicines
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin','pharmacist'));

CREATE POLICY "medicines_update" ON medicines
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin','pharmacist'));

CREATE POLICY "medicines_delete" ON medicines
  FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

-- SALES: admin sees all, others see own branch
CREATE POLICY "sales_select" ON sales
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR branch_id = get_user_branch_id()
  );

CREATE POLICY "sales_insert" ON sales
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "sales_update" ON sales
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

-- SALE ITEMS: follow parent sale access
CREATE POLICY "sale_items_select" ON sale_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sale_items_insert" ON sale_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- STOCK TRANSFERS: admin sees all, others see related branches
CREATE POLICY "transfers_select" ON stock_transfers
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR from_branch_id = get_user_branch_id()
    OR to_branch_id = get_user_branch_id()
  );

CREATE POLICY "transfers_insert" ON stock_transfers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "transfers_update" ON stock_transfers
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

-- AUDIT LOGS: only admin can read, all can insert
CREATE POLICY "audit_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS: users see their own
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR branch_id = get_user_branch_id());

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- --------------------------------------------------------
-- SAVED REPORTS
-- --------------------------------------------------------
CREATE TABLE saved_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type   TEXT NOT NULL,
  title         TEXT NOT NULL,
  period        TEXT NOT NULL,
  summary       JSONB NOT NULL DEFAULT '{}',
  data          JSONB NOT NULL DEFAULT '[]',
  generated_by  UUID REFERENCES users(id),
  branch_id     UUID REFERENCES branches(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_reports_select" ON saved_reports
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR branch_id = get_user_branch_id());

CREATE POLICY "saved_reports_insert" ON saved_reports
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin','pharmacist'));

CREATE POLICY "saved_reports_delete" ON saved_reports
  FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

CREATE TABLE report_settings (
  key           TEXT PRIMARY KEY DEFAULT 'default',
  recipients    TEXT[] NOT NULL DEFAULT '{}',
  updated_by    UUID REFERENCES users(id),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_settings_select" ON report_settings
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "report_settings_insert" ON report_settings
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "report_settings_update" ON report_settings
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ========================================================
-- SEED DATA (optional — remove in production)
-- ========================================================

-- Insert a default branch
INSERT INTO branches (name, location, phone)
VALUES ('Main Branch', 'Nairobi CBD', '+254700000000');

-- Note: After running this schema, create your first admin user
-- through Supabase Auth, then insert into the users table:
--
-- INSERT INTO users (id, email, full_name, role, branch_id)
-- VALUES (
--   '<auth-user-uuid>',
--   'admin@lkpharmacare.com',
--   'Admin User',
--   'admin',
--   (SELECT id FROM branches WHERE name = 'Main Branch')
-- );
