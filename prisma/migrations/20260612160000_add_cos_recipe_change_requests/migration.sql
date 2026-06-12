-- CreateEnum
CREATE TYPE "CosTableRecipeChangeAction" AS ENUM ('UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "CosTableRecipeChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "cos_table_recipe_change_requests" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "action" "CosTableRecipeChangeAction" NOT NULL,
    "payload" JSONB,
    "status" "CosTableRecipeChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestNote" TEXT NOT NULL DEFAULT '',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_table_recipe_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cos_table_recipe_change_requests_status_createdAt_idx" ON "cos_table_recipe_change_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "cos_table_recipe_change_requests_recipeId_status_idx" ON "cos_table_recipe_change_requests"("recipeId", "status");

-- AddForeignKey
ALTER TABLE "cos_table_recipe_change_requests" ADD CONSTRAINT "cos_table_recipe_change_requests_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "cos_table_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_recipe_change_requests" ADD CONSTRAINT "cos_table_recipe_change_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cos_table_recipe_change_requests" ADD CONSTRAINT "cos_table_recipe_change_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
