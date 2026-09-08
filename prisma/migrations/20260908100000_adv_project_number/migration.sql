-- AlterTable
ALTER TABLE "adv_projects" ADD COLUMN "projectNumber" TEXT;

-- Backfill existing rows (stable order by createdAt)
WITH numbered AS (
  SELECT
    id,
    'PRJ-' || TO_CHAR("createdAt", 'YYYY') || '-' ||
      LPAD(
        CAST(
          ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM "createdAt")
            ORDER BY "createdAt" ASC, id ASC
          ) AS TEXT
        ),
        5,
        '0'
      ) AS project_number
  FROM "adv_projects"
  WHERE "projectNumber" IS NULL
)
UPDATE "adv_projects" AS p
SET "projectNumber" = numbered.project_number
FROM numbered
WHERE p.id = numbered.id;

-- AlterTable
ALTER TABLE "adv_projects" ALTER COLUMN "projectNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "adv_projects_projectNumber_key" ON "adv_projects"("projectNumber");
