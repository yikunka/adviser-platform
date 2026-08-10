-- Remove CosmoCoat platform: clean data, drop cos_* tables/enums, shrink Platform enum.

-- Data cleanup before Platform enum shrink
UPDATE "users" SET "platform" = 'ADVISER' WHERE "platform"::text = 'COSMICOAT';
UPDATE "users" SET "adminPlatforms" = array_remove("adminPlatforms", 'COSMICOAT'::"Platform")
WHERE 'COSMICOAT'::"Platform" = ANY("adminPlatforms");
UPDATE "admin_roles"
SET "permissions" = COALESCE((
  SELECT array_agg(p)
  FROM unnest("permissions") AS p
  WHERE p NOT LIKE 'cosmocoat%'
), ARRAY[]::text[]);
-- AlterEnum
BEGIN;
CREATE TYPE "Platform_new" AS ENUM ('ADVISER', 'SFS_DIAMOND');
ALTER TABLE "public"."users" ALTER COLUMN "adminPlatforms" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "platform" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "platform" TYPE "Platform_new" USING ("platform"::text::"Platform_new");
ALTER TABLE "users" ALTER COLUMN "adminPlatforms" TYPE "Platform_new"[] USING ("adminPlatforms"::text::"Platform_new"[]);
ALTER TYPE "Platform" RENAME TO "Platform_old";
ALTER TYPE "Platform_new" RENAME TO "Platform";
DROP TYPE "public"."Platform_old";
ALTER TABLE "users" ALTER COLUMN "adminPlatforms" SET DEFAULT ARRAY[]::"Platform"[];
ALTER TABLE "users" ALTER COLUMN "platform" SET DEFAULT 'ADVISER';
COMMIT;

-- DropForeignKey
ALTER TABLE "cos_account_balances" DROP CONSTRAINT "cos_account_balances_accountId_fkey";

-- DropForeignKey
ALTER TABLE "cos_accounts" DROP CONSTRAINT "cos_accounts_parentId_fkey";

-- DropForeignKey
ALTER TABLE "cos_customer_business_licenses" DROP CONSTRAINT "cos_customer_business_licenses_customerId_fkey";

-- DropForeignKey
ALTER TABLE "cos_customer_business_licenses" DROP CONSTRAINT "cos_customer_business_licenses_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "cos_customers" DROP CONSTRAINT "cos_customers_createdById_fkey";

-- DropForeignKey
ALTER TABLE "cos_customers" DROP CONSTRAINT "cos_customers_salesEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_customers" DROP CONSTRAINT "cos_customers_technicalEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_customers" DROP CONSTRAINT "cos_customers_userId_fkey";

-- DropForeignKey
ALTER TABLE "cos_employee_files" DROP CONSTRAINT "cos_employee_files_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_employee_files" DROP CONSTRAINT "cos_employee_files_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "cos_employees" DROP CONSTRAINT "cos_employees_createdById_fkey";

-- DropForeignKey
ALTER TABLE "cos_journal_entries" DROP CONSTRAINT "cos_journal_entries_createdById_fkey";

-- DropForeignKey
ALTER TABLE "cos_journal_lines" DROP CONSTRAINT "cos_journal_lines_accountId_fkey";

-- DropForeignKey
ALTER TABLE "cos_journal_lines" DROP CONSTRAINT "cos_journal_lines_entryId_fkey";

-- DropForeignKey
ALTER TABLE "cos_ledger" DROP CONSTRAINT "cos_ledger_accountId_fkey";

-- DropForeignKey
ALTER TABLE "cos_ledger" DROP CONSTRAINT "cos_ledger_entryId_fkey";

-- DropForeignKey
ALTER TABLE "cos_process_kit_change_requests" DROP CONSTRAINT "cos_process_kit_change_requests_kitId_fkey";

-- DropForeignKey
ALTER TABLE "cos_process_kit_change_requests" DROP CONSTRAINT "cos_process_kit_change_requests_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "cos_process_kit_change_requests" DROP CONSTRAINT "cos_process_kit_change_requests_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "cos_process_kit_products" DROP CONSTRAINT "cos_process_kit_products_kitId_fkey";

-- DropForeignKey
ALTER TABLE "cos_process_kits" DROP CONSTRAINT "cos_process_kits_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "cos_process_kits" DROP CONSTRAINT "cos_process_kits_updatedBy_fkey";

-- DropForeignKey
ALTER TABLE "cos_process_tests" DROP CONSTRAINT "cos_process_tests_kitId_fkey";

-- DropForeignKey
ALTER TABLE "cos_process_tests" DROP CONSTRAINT "cos_process_tests_testerId_fkey";

-- DropForeignKey
ALTER TABLE "cos_qualification_files" DROP CONSTRAINT "cos_qualification_files_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "cos_sample_order_color_formulas" DROP CONSTRAINT "cos_sample_order_color_formulas_colorFormulaId_fkey";

-- DropForeignKey
ALTER TABLE "cos_sample_order_color_formulas" DROP CONSTRAINT "cos_sample_order_color_formulas_sampleOrderId_fkey";

-- DropForeignKey
ALTER TABLE "cos_sample_order_process_kits" DROP CONSTRAINT "cos_sample_order_process_kits_processKitId_fkey";

-- DropForeignKey
ALTER TABLE "cos_sample_order_process_kits" DROP CONSTRAINT "cos_sample_order_process_kits_sampleOrderId_fkey";

-- DropForeignKey
ALTER TABLE "cos_sample_orders" DROP CONSTRAINT "cos_sample_orders_createdById_fkey";

-- DropForeignKey
ALTER TABLE "cos_sample_orders" DROP CONSTRAINT "cos_sample_orders_customerId_fkey";

-- DropForeignKey
ALTER TABLE "cos_sample_orders" DROP CONSTRAINT "cos_sample_orders_salesEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_sample_orders" DROP CONSTRAINT "cos_sample_orders_technicalEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_supplier_files" DROP CONSTRAINT "cos_supplier_files_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "cos_supplier_files" DROP CONSTRAINT "cos_supplier_files_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "cos_suppliers" DROP CONSTRAINT "cos_suppliers_createdById_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_color_formula_items" DROP CONSTRAINT "cos_table_color_formula_items_formulaId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_color_formula_items" DROP CONSTRAINT "cos_table_color_formula_items_productSemifinishedId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_color_formula_items" DROP CONSTRAINT "cos_table_color_formula_items_rawMaterialId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_color_formulas" DROP CONSTRAINT "cos_table_color_formulas_customerId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_color_formulas" DROP CONSTRAINT "cos_table_color_formulas_factoryProductId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_color_formulas" DROP CONSTRAINT "cos_table_color_formulas_sourceRecipeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_color_formulas" DROP CONSTRAINT "cos_table_color_formulas_subcategoryId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_color_formulas" DROP CONSTRAINT "cos_table_color_formulas_technicalOwnerId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_factory_products" DROP CONSTRAINT "cos_table_factory_products_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_factory_products" DROP CONSTRAINT "cos_table_factory_products_currentRecipeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_product_categories" DROP CONSTRAINT "cos_table_product_categories_parentCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_product_recipes" DROP CONSTRAINT "cos_table_product_recipes_productId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_product_recipes" DROP CONSTRAINT "cos_table_product_recipes_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_product_semifinished" DROP CONSTRAINT "cos_table_product_semifinished_sourceProductionOrderId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_production_order_items" DROP CONSTRAINT "cos_table_production_order_items_componentRecipeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_production_order_items" DROP CONSTRAINT "cos_table_production_order_items_orderId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_production_order_items" DROP CONSTRAINT "cos_table_production_order_items_productSemifinishedId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_production_order_items" DROP CONSTRAINT "cos_table_production_order_items_rawMaterialId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_production_orders" DROP CONSTRAINT "cos_table_production_orders_factoryProductId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_production_orders" DROP CONSTRAINT "cos_table_production_orders_productionEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_production_orders" DROP CONSTRAINT "cos_table_production_orders_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_raw_materials" DROP CONSTRAINT "cos_table_raw_materials_primarySupplierId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_raw_materials" DROP CONSTRAINT "cos_table_raw_materials_secondarySupplierId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_recipe_change_requests" DROP CONSTRAINT "cos_table_recipe_change_requests_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_recipe_change_requests" DROP CONSTRAINT "cos_table_recipe_change_requests_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_recipe_change_requests" DROP CONSTRAINT "cos_table_recipe_change_requests_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_recipe_items" DROP CONSTRAINT "cos_table_recipe_items_componentRecipeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_recipe_items" DROP CONSTRAINT "cos_table_recipe_items_factoryProductId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_recipe_items" DROP CONSTRAINT "cos_table_recipe_items_productSemifinishedId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_recipe_items" DROP CONSTRAINT "cos_table_recipe_items_rawMaterialId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_recipe_items" DROP CONSTRAINT "cos_table_recipe_items_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "cos_table_recipes" DROP CONSTRAINT "cos_table_recipes_categoryId_fkey";

-- AlterTable
ALTER TABLE "adv_feedback_config" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "adv_journal_entries" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_report_groups" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sfs_order_steps" ALTER COLUMN "fileKeys" DROP DEFAULT;

-- DropTable
DROP TABLE "cos_account_balances";

-- DropTable
DROP TABLE "cos_accounts";

-- DropTable
DROP TABLE "cos_customer_business_licenses";

-- DropTable
DROP TABLE "cos_customers";

-- DropTable
DROP TABLE "cos_employee_files";

-- DropTable
DROP TABLE "cos_employees";

-- DropTable
DROP TABLE "cos_exchange_rates";

-- DropTable
DROP TABLE "cos_journal_entries";

-- DropTable
DROP TABLE "cos_journal_lines";

-- DropTable
DROP TABLE "cos_ledger";

-- DropTable
DROP TABLE "cos_process_kit_change_requests";

-- DropTable
DROP TABLE "cos_process_kit_products";

-- DropTable
DROP TABLE "cos_process_kits";

-- DropTable
DROP TABLE "cos_process_tests";

-- DropTable
DROP TABLE "cos_qualification_files";

-- DropTable
DROP TABLE "cos_sample_order_color_formulas";

-- DropTable
DROP TABLE "cos_sample_order_process_kits";

-- DropTable
DROP TABLE "cos_sample_orders";

-- DropTable
DROP TABLE "cos_supplier_files";

-- DropTable
DROP TABLE "cos_suppliers";

-- DropTable
DROP TABLE "cos_table_color_formula_items";

-- DropTable
DROP TABLE "cos_table_color_formula_subcategories";

-- DropTable
DROP TABLE "cos_table_color_formulas";

-- DropTable
DROP TABLE "cos_table_factory_products";

-- DropTable
DROP TABLE "cos_table_product_categories";

-- DropTable
DROP TABLE "cos_table_product_recipes";

-- DropTable
DROP TABLE "cos_table_product_semifinished";

-- DropTable
DROP TABLE "cos_table_production_order_items";

-- DropTable
DROP TABLE "cos_table_production_orders";

-- DropTable
DROP TABLE "cos_table_products";

-- DropTable
DROP TABLE "cos_table_raw_materials";

-- DropTable
DROP TABLE "cos_table_recipe_categories";

-- DropTable
DROP TABLE "cos_table_recipe_change_requests";

-- DropTable
DROP TABLE "cos_table_recipe_items";

-- DropTable
DROP TABLE "cos_table_recipes";

-- DropEnum
DROP TYPE "CosColorFormulaCategory";

-- DropEnum
DROP TYPE "CosEmployeeFileType";

-- DropEnum
DROP TYPE "CosEmployeeType";

-- DropEnum
DROP TYPE "CosProcessKitChangeAction";

-- DropEnum
DROP TYPE "CosProcessKitChangeRequestStatus";

-- DropEnum
DROP TYPE "CosSampleOrderStatus";

-- DropEnum
DROP TYPE "CosTableRecipeChangeAction";

-- DropEnum
DROP TYPE "CosTableRecipeChangeRequestStatus";

-- DropEnum
DROP TYPE "ProcessKitStatus";

-- RenameIndex
ALTER INDEX "adv_tcsp_service_prices_jurisdiction_customerLevel_serviceConte" RENAME TO "adv_tcsp_service_prices_jurisdiction_customerLevel_serviceC_key";
