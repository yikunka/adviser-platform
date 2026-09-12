-- Normalize companyLegalType labels to title case

UPDATE "companies"
SET "companyLegalType" = CASE lower("companyLegalType")
  WHEN 'private company limited by shares' THEN 'Private Company Limited by Shares'
  WHEN 'public company limited by shares' THEN 'Public Company Limited by Shares'
  WHEN 'company limited by guarantee' THEN 'Company Limited by Guarantee'
  WHEN 'private unlimited company' THEN 'Private Unlimited Company'
  WHEN 'public unlimited company' THEN 'Public Unlimited Company'
  WHEN 'branch office' THEN 'Branch Office'
  ELSE "companyLegalType"
END
WHERE "companyLegalType" IS NOT NULL;
