-- CreateTable
CREATE TABLE "adv_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_journal_entries" (
    "id" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "postedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "adv_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "lineNum" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "debit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "credit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "adv_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_ledger" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "entryId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "debit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "credit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0.0,

    CONSTRAINT "adv_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_account_balances" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "openingDebit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "openingCredit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "closingDebit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "closingCredit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "endingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0.0,

    CONSTRAINT "adv_account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_exchange_rates" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(10,6) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adv_accounts_code_key" ON "adv_accounts"("code");

-- CreateIndex
CREATE INDEX "adv_accounts_type_sortOrder_idx" ON "adv_accounts"("type", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "adv_journal_entries_voucherNo_key" ON "adv_journal_entries"("voucherNo");

-- CreateIndex
CREATE INDEX "adv_journal_entries_period_status_idx" ON "adv_journal_entries"("period", "status");

-- CreateIndex
CREATE INDEX "adv_journal_entries_entryDate_idx" ON "adv_journal_entries"("entryDate");

-- CreateIndex
CREATE INDEX "adv_journal_lines_entryId_lineNum_idx" ON "adv_journal_lines"("entryId", "lineNum");

-- CreateIndex
CREATE INDEX "adv_journal_lines_accountId_idx" ON "adv_journal_lines"("accountId");

-- CreateIndex
CREATE INDEX "adv_ledger_accountId_date_idx" ON "adv_ledger"("accountId", "date");

-- CreateIndex
CREATE INDEX "adv_ledger_date_idx" ON "adv_ledger"("date");

-- CreateIndex
CREATE INDEX "adv_ledger_voucherNo_idx" ON "adv_ledger"("voucherNo");

-- CreateIndex
CREATE INDEX "adv_account_balances_period_idx" ON "adv_account_balances"("period");

-- CreateIndex
CREATE UNIQUE INDEX "adv_account_balances_accountId_period_key" ON "adv_account_balances"("accountId", "period");

-- CreateIndex
CREATE INDEX "adv_exchange_rates_fromCurrency_toCurrency_idx" ON "adv_exchange_rates"("fromCurrency", "toCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "adv_exchange_rates_fromCurrency_toCurrency_effectiveDate_key" ON "adv_exchange_rates"("fromCurrency", "toCurrency", "effectiveDate");

-- AddForeignKey
ALTER TABLE "adv_accounts" ADD CONSTRAINT "adv_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "adv_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_journal_entries" ADD CONSTRAINT "adv_journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_journal_lines" ADD CONSTRAINT "adv_journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "adv_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_journal_lines" ADD CONSTRAINT "adv_journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "adv_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_ledger" ADD CONSTRAINT "adv_ledger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "adv_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_ledger" ADD CONSTRAINT "adv_ledger_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "adv_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_account_balances" ADD CONSTRAINT "adv_account_balances_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "adv_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
