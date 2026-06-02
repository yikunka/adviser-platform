ALTER TABLE "adv_accounts"
ADD COLUMN "yearToDateDebit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
ADD COLUMN "yearToDateCredit" DECIMAL(18,4) NOT NULL DEFAULT 0.0;

UPDATE "adv_accounts"
SET
  "yearToDateDebit" = CASE
    WHEN "type" IN ('LIABILITY', 'EQUITY', 'REVENUE') THEN 0.0
    WHEN "type" = 'CURRENT_ACCOUNT' AND "code" LIKE '2%' THEN 0.0
    ELSE "yearToDateAmount"
  END,
  "yearToDateCredit" = CASE
    WHEN "type" IN ('LIABILITY', 'EQUITY', 'REVENUE') THEN "yearToDateAmount"
    WHEN "type" = 'CURRENT_ACCOUNT' AND "code" LIKE '2%' THEN "yearToDateAmount"
    ELSE 0.0
  END;
