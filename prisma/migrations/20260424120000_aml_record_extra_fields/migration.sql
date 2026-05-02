-- AlterTable
ALTER TABLE "aml_records" ADD COLUMN "gender" TEXT,
                           ADD COLUMN "placeOfBirth" TEXT,
                           ADD COLUMN "addresses" JSONB;
