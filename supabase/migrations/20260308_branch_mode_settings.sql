ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS enable_pharmacy BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_beauty BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE branches
  DROP CONSTRAINT IF EXISTS branches_at_least_one_mode;

ALTER TABLE branches
  ADD CONSTRAINT branches_at_least_one_mode
  CHECK (enable_pharmacy OR enable_beauty);

UPDATE branches
SET
  enable_pharmacy = COALESCE(enable_pharmacy, true),
  enable_beauty = COALESCE(enable_beauty, true)
WHERE enable_pharmacy IS NULL OR enable_beauty IS NULL;