ALTER TABLE "cos_process_tests" DROP CONSTRAINT IF EXISTS "cos_process_tests_testerId_fkey";

UPDATE "cos_process_tests" AS test
SET "testerId" = NULL
WHERE test."testerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "cos_employees" AS employee
    WHERE employee."id" = test."testerId"
  );

CREATE INDEX IF NOT EXISTS "cos_process_tests_testerId_idx" ON "cos_process_tests"("testerId");

ALTER TABLE "cos_process_tests"
  ADD CONSTRAINT "cos_process_tests_testerId_fkey"
  FOREIGN KEY ("testerId") REFERENCES "cos_employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
