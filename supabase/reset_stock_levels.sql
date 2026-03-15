-- ========================================================
-- LK PharmaCare — Reset Stock Levels (After Clearing Sales)
-- ========================================================
-- Run this AFTER clearing sales data to zero out medicine
-- stock levels. Sets quantity_in_stock to 0 for all medicines.
-- ========================================================

BEGIN;

-- Show current state
SELECT 'before' AS phase,
       COUNT(*) FILTER (WHERE quantity_in_stock = 0) AS out_of_stock,
       COUNT(*) FILTER (WHERE quantity_in_stock > 0 AND quantity_in_stock <= reorder_level) AS low_stock,
       COUNT(*) FILTER (WHERE quantity_in_stock > reorder_level) AS in_stock,
       COUNT(*) AS total
FROM public.medicines;

-- Reset all stock to 0
UPDATE public.medicines
SET quantity_in_stock = 0,
    updated_at = now();

-- Verify after reset
SELECT 'after' AS phase,
       COUNT(*) FILTER (WHERE quantity_in_stock = 0) AS out_of_stock,
       COUNT(*) FILTER (WHERE quantity_in_stock > 0 AND quantity_in_stock <= reorder_level) AS low_stock,
       COUNT(*) FILTER (WHERE quantity_in_stock > reorder_level) AS in_stock,
       COUNT(*) AS total
FROM public.medicines;

COMMIT;
