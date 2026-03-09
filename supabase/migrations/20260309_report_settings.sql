CREATE TABLE IF NOT EXISTS report_settings (
  key TEXT PRIMARY KEY DEFAULT 'default',
  recipients TEXT[] NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE report_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_settings_select" ON report_settings;
CREATE POLICY "report_settings_select" ON report_settings
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "report_settings_insert" ON report_settings;
CREATE POLICY "report_settings_insert" ON report_settings
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

DROP POLICY IF EXISTS "report_settings_update" ON report_settings;
CREATE POLICY "report_settings_update" ON report_settings
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');