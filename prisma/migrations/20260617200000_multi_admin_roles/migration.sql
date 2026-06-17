-- CreateTable
CREATE TABLE "user_admin_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_admin_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateIndex
CREATE INDEX "user_admin_roles_roleId_idx" ON "user_admin_roles"("roleId");

-- Migrate existing single-role assignments to the join table
INSERT INTO "user_admin_roles" ("userId", "roleId")
SELECT "id", "adminRoleId" FROM "users" WHERE "adminRoleId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "user_admin_roles" ADD CONSTRAINT "user_admin_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_admin_roles" ADD CONSTRAINT "user_admin_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_adminRoleId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "adminRoleId";
