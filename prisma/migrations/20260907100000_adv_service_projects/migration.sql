-- CreateEnum
CREATE TYPE "AdvProjectType" AS ENUM ('COMPANY_INCORPORATION', 'CORPORATE_SECRETARIAL', 'ACCOUNTING', 'OTHER');

-- CreateEnum
CREATE TYPE "AdvProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'RENEWED');

-- CreateEnum
CREATE TYPE "AdvProjectTaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "adv_projects" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectType" "AdvProjectType" NOT NULL,
    "status" "AdvProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "renewedFromId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_project_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AdvProjectTaskStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_project_invoices" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adv_project_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adv_projects_renewedFromId_key" ON "adv_projects"("renewedFromId");

-- CreateIndex
CREATE INDEX "adv_projects_companyId_status_idx" ON "adv_projects"("companyId", "status");

-- CreateIndex
CREATE INDEX "adv_projects_endDate_status_idx" ON "adv_projects"("endDate", "status");

-- CreateIndex
CREATE INDEX "adv_projects_projectType_idx" ON "adv_projects"("projectType");

-- CreateIndex
CREATE INDEX "adv_project_tasks_projectId_status_idx" ON "adv_project_tasks"("projectId", "status");

-- CreateIndex
CREATE INDEX "adv_project_invoices_invoiceId_idx" ON "adv_project_invoices"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "adv_project_invoices_projectId_invoiceId_key" ON "adv_project_invoices"("projectId", "invoiceId");

-- AddForeignKey
ALTER TABLE "adv_projects" ADD CONSTRAINT "adv_projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_projects" ADD CONSTRAINT "adv_projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_projects" ADD CONSTRAINT "adv_projects_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "adv_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_project_tasks" ADD CONSTRAINT "adv_project_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "adv_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_project_tasks" ADD CONSTRAINT "adv_project_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_project_tasks" ADD CONSTRAINT "adv_project_tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_project_invoices" ADD CONSTRAINT "adv_project_invoices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "adv_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_project_invoices" ADD CONSTRAINT "adv_project_invoices_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
