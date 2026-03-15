-- ========================================================
-- LK PharmaCare — Reset Test Data (Fresh Start)
-- ========================================================
-- What this clears:
--   - Sales history + sale items + receipts
--   - Credit history
--   - Transfers, notifications, saved reports, audit logs
--
-- What this resets:
--   - Medicine stock levels → 0 (zeroed out)
--
-- What this keeps:
--   - Branches, medicines (with reset stock)
--   - Users/auth accounts
--   - Schema, RLS policies, functions
-- ========================================================

BEGIN;

-- Optional visibility before delete
SELECT 'before.sales' AS metric, COUNT(*)::bigint AS total FROM public.sales;
SELECT 'before.sale_items' AS metric, COUNT(*)::bigint AS total FROM public.sale_items;
SELECT 'before.medicines' AS metric, COUNT(*)::bigint AS total FROM public.medicines;

DO $$
BEGIN
  IF to_regclass('public.receipts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.receipts';
  END IF;

  IF to_regclass('public.credits') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.credits';
  END IF;

  IF to_regclass('public.saved_reports') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.saved_reports';
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notifications';
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.audit_logs';
  END IF;

  IF to_regclass('public.stock_transfers') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.stock_transfers';
  END IF;

  IF to_regclass('public.sale_items') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.sale_items';
  END IF;

  IF to_regclass('public.sales') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.sales';
  END IF;

  -- Reset stock levels instead of deleting medicines
  IF to_regclass('public.medicines') IS NOT NULL THEN
    EXECUTE 'UPDATE public.medicines SET quantity_in_stock = 0, updated_at = now()';
  END IF;
END $$;

-- Optional visibility after delete
SELECT 'after.sales' AS metric, COUNT(*)::bigint AS total FROM public.sales;
SELECT 'after.sale_items' AS metric, COUNT(*)::bigint AS total FROM public.sale_items;
SELECT 'after.medicines' AS metric, COUNT(*)::bigint AS total FROM public.medicines;

COMMIT;
