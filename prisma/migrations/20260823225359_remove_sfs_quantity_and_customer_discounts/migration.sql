-- AlterTable
ALTER TABLE "sfs_customers" DROP COLUMN IF EXISTS "discountRate";

-- DropTable
DROP TABLE IF EXISTS "sfs_diamond_price_tiers";
