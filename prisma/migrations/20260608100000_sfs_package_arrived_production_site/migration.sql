-- Shift existing CHEM_TRANSFORM steps from step 2 onward to make room for
-- new step 2 (Package arrived production site)
UPDATE "sfs_order_steps"
SET "stepNumber" = "stepNumber" + 1
WHERE "phase" = 'CHEM_TRANSFORM' AND "stepNumber" >= 2;
