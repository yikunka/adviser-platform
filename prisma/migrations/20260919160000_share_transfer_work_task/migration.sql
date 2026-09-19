-- CreateEnum
CREATE TYPE "AdvWorkTaskKind" AS ENUM ('SHARE_TRANSFER');

-- CreateTable
CREATE TABLE "adv_work_tasks" (
    "id" TEXT NOT NULL,
    "taskNumber" TEXT NOT NULL,
    "kind" "AdvWorkTaskKind" NOT NULL,
    "companyId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_work_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_work_task_files" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adv_work_task_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adv_work_tasks_taskNumber_key" ON "adv_work_tasks"("taskNumber");

-- CreateIndex
CREATE INDEX "adv_work_tasks_companyId_createdAt_idx" ON "adv_work_tasks"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "adv_work_tasks_kind_createdAt_idx" ON "adv_work_tasks"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "adv_work_task_files_taskId_idx" ON "adv_work_task_files"("taskId");

-- AddForeignKey
ALTER TABLE "adv_work_tasks" ADD CONSTRAINT "adv_work_tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_work_tasks" ADD CONSTRAINT "adv_work_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_work_task_files" ADD CONSTRAINT "adv_work_task_files_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "adv_work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
