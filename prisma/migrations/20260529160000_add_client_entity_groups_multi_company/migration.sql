-- CreateTable
CREATE TABLE "client_entity_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_entity_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_entity_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_entity_group_members_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "groupId" TEXT;

-- AlterTable
ALTER TABLE "adv_journal_entries" ADD COLUMN "companyId" TEXT,
ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "client_entity_groups_name_idx" ON "client_entity_groups"("name");

-- CreateIndex
CREATE INDEX "client_entity_group_members_userId_idx" ON "client_entity_group_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "client_entity_group_members_groupId_userId_key" ON "client_entity_group_members"("groupId", "userId");

-- CreateIndex
CREATE INDEX "companies_groupId_idx" ON "companies"("groupId");

-- CreateIndex
CREATE INDEX "adv_journal_entries_companyId_idx" ON "adv_journal_entries"("companyId");

-- CreateIndex
CREATE INDEX "adv_journal_entries_groupId_idx" ON "adv_journal_entries"("groupId");

-- AddForeignKey
ALTER TABLE "client_entity_group_members" ADD CONSTRAINT "client_entity_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "client_entity_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_entity_group_members" ADD CONSTRAINT "client_entity_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "client_entity_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_journal_entries" ADD CONSTRAINT "adv_journal_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_journal_entries" ADD CONSTRAINT "adv_journal_entries_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "client_entity_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
