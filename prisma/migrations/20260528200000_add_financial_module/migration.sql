-- Create enums for financial module
CREATE TYPE "AccountType"   AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- ========================================
-- CosTableAccount - 会计科目表
-- ========================================
CREATE TABLE "cos_accounts" (
    "id"        TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "type"      "AccountType" NOT NULL,
    "parentId"  TEXT,
    "level"     INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem"  BOOLEAN NOT NULL DEFAULT false,
    "notes"     TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cos_accounts_code_key" ON "cos_accounts"("code");
CREATE INDEX "cos_accounts_type_sortOrder_idx" ON "cos_accounts"("type", "sortOrder");

ALTER TABLE "cos_accounts"
    ADD CONSTRAINT "cos_accounts_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "cos_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ========================================
-- CosTableJournalEntry - 日记账凭证头
-- ========================================
CREATE TABLE "cos_journal_entries" (
    "id"          TEXT NOT NULL,
    "voucherNo"   TEXT NOT NULL,
    "entryDate"   TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "period"      TEXT NOT NULL,
    "status"      "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "attachments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "postedAt"    TIMESTAMP(3),
    "reversedAt"  TIMESTAMP(3),

    CONSTRAINT "cos_journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cos_journal_entries_voucherNo_key" ON "cos_journal_entries"("voucherNo");
CREATE INDEX "cos_journal_entries_period_status_idx" ON "cos_journal_entries"("period", "status");
CREATE INDEX "cos_journal_entries_entryDate_idx"      ON "cos_journal_entries"("entryDate");

ALTER TABLE "cos_journal_entries"
    ADD CONSTRAINT "cos_journal_entries_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ========================================
-- CosTableJournalLine - 日记账分录明细
-- ========================================
CREATE TABLE "cos_journal_lines" (
    "id"          TEXT NOT NULL,
    "entryId"     TEXT NOT NULL,
    "accountId"   TEXT NOT NULL,
    "lineNum"     INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "debit"       DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "credit"      DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "notes"       TEXT NOT NULL DEFAULT '',

    CONSTRAINT "cos_journal_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cos_journal_lines_entryId_lineNum_idx" ON "cos_journal_lines"("entryId", "lineNum");
CREATE INDEX "cos_journal_lines_accountId_idx"        ON "cos_journal_lines"("accountId");

ALTER TABLE "cos_journal_lines"
    ADD CONSTRAINT "cos_journal_lines_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "cos_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cos_journal_lines"
    ADD CONSTRAINT "cos_journal_lines_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "cos_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ========================================
-- CosTableLedger - 分类账（自动过账）
-- ========================================
CREATE TABLE "cos_ledger" (
    "id"          TEXT NOT NULL,
    "accountId"   TEXT NOT NULL,
    "entryId"     TEXT,
    "date"        TIMESTAMP(3) NOT NULL,
    "voucherNo"   TEXT,
    "description" TEXT NOT NULL,
    "debit"       DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "credit"      DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "balance"     DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cos_ledger_accountId_date_idx" ON "cos_ledger"("accountId", "date");
CREATE INDEX "cos_ledger_date_idx"            ON "cos_ledger"("date");
CREATE INDEX "cos_ledger_voucherNo_idx"       ON "cos_ledger"("voucherNo");

ALTER TABLE "cos_ledger"
    ADD CONSTRAINT "cos_ledger_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "cos_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cos_ledger"
    ADD CONSTRAINT "cos_ledger_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "cos_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ========================================
-- CosTableAccountBalance - 科目期间余额
-- ========================================
CREATE TABLE "cos_account_balances" (
    "id"            TEXT NOT NULL,
    "accountId"     TEXT NOT NULL,
    "period"        TEXT NOT NULL,
    "openingDebit"  DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "openingCredit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "closingDebit"  DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "closingCredit" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "endingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0.0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_account_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cos_account_balances_accountId_period_key" ON "cos_account_balances"("accountId", "period");
CREATE INDEX "cos_account_balances_period_idx" ON "cos_account_balances"("period");

ALTER TABLE "cos_account_balances"
    ADD CONSTRAINT "cos_account_balances_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "cos_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ========================================
-- CosTableExchangeRate - 汇率管理
-- ========================================
CREATE TABLE "cos_exchange_rates" (
    "id"            TEXT NOT NULL,
    "fromCurrency"  TEXT NOT NULL,
    "toCurrency"    TEXT NOT NULL,
    "rate"          DECIMAL(10,6) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cos_exchange_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cos_exchange_rates_fromCurrency_toCurrency_effectiveDate_key"
    ON "cos_exchange_rates"("fromCurrency", "toCurrency", "effectiveDate");
CREATE INDEX "cos_exchange_rates_fromCurrency_toCurrency_idx"
    ON "cos_exchange_rates"("fromCurrency", "toCurrency");

-- ========================================
-- Seed Data: Standard Hong Kong Chart of Accounts
-- ========================================
INSERT INTO "cos_accounts" ("id","code","name","type","level","sortOrder","isSystem","updatedAt") VALUES
('acc_1001','1001','现金 CASH IN HAND',                              'ASSET',    2, 1,  true, NOW()),
('acc_1002','1002','银行存款 - HKD BANK - HKD',                     'ASSET',    2, 2,  true, NOW()),
('acc_1003','1003','银行存款 - USD BANK - USD',                     'ASSET',    2, 3,  true, NOW()),
('acc_1004','1004','银行存款 - RMB BANK - RMB',                    'ASSET',    2, 4,  true, NOW()),
('acc_1100','1100','应收账款 ACCOUNTS RECEIVABLE',                  'ASSET',    2, 10, true, NOW()),
('acc_1101','1101','客户应收账款 TRADE RECEIVABLES',                'ASSET',    3, 1,  true, NOW()),
('acc_1102','1102','其他应收款 OTHER RECEIVABLES',                  'ASSET',    3, 2,  true, NOW()),
('acc_1200','1200','存货 INVENTORY',                                'ASSET',    2, 20, true, NOW()),
('acc_1300','1300','固定资产 FIXED ASSETS',                         'ASSET',    2, 30, true, NOW()),
('acc_1301','1301','土地及楼宇 LAND AND BUILDINGS',                 'ASSET',    3, 1,  true, NOW()),
('acc_1302','1302','机械设备 MACHINERY & EQUIPMENT',                'ASSET',    3, 2,  true, NOW()),
('acc_1303','1303','办公设备 OFFICE FURNITURE & EQUIPMENT',         'ASSET',    3, 3,  true, NOW()),
('acc_1399','1399','累计折旧 ACCUMULATED DEPRECIATION',             'ASSET',    3, 99, true, NOW()),
('acc_2001','2001','应付账款 ACCOUNTS PAYABLE',                     'LIABILITY',2, 1,  true, NOW()),
('acc_2100','2100','其他应付款 OTHER PAYABLES',                     'LIABILITY',2, 10, true, NOW()),
('acc_2200','2200','银行贷款 BANK LOANS',                           'LIABILITY',2, 20, true, NOW()),
('acc_2300','2300','应缴税款 TAXES PAYABLE',                        'LIABILITY',2, 30, true, NOW()),
('acc_2301','2301','所得税 TAXES PAYABLE - INCOME TAX',             'LIABILITY',3, 1,  true, NOW()),
('acc_3001','3001','实收资本 SHARE CAPITAL',                        'EQUITY',   2, 1,  true, NOW()),
('acc_3100','3100','留存收益 RETAINED EARNINGS',                    'EQUITY',   2, 10, true, NOW()),
('acc_4001','4001','销售收入 SALES REVENUE',                        'REVENUE',  2, 1,  true, NOW()),
('acc_4100','4100','服务收入 SERVICE INCOME',                       'REVENUE',  2, 10, true, NOW()),
('acc_5000','5000','销货成本 COST OF GOODS SOLD',                   'EXPENSE',  2, 1,  true, NOW()),
('acc_5001','5001','原材料 RAW MATERIALS',                          'EXPENSE',  3, 1,  true, NOW()),
('acc_5002','5002','直接人工 DIRECT LABOR',                         'EXPENSE',  3, 2,  true, NOW()),
('acc_5003','5003','制造费用 MANUFACTURING OVERHEAD',               'EXPENSE',  3, 3,  true, NOW()),
('acc_6000','6000','运营费用 OPERATING EXPENSES',                   'EXPENSE',  2, 10, true, NOW()),
('acc_6001','6001','工资薪金 SALARIES & WAGES',                     'EXPENSE',  3, 1,  true, NOW()),
('acc_6002','6002','办公费用 OFFICE EXPENSES',                      'EXPENSE',  3, 2,  true, NOW()),
('acc_6003','6003','租金费用 RENTAL EXPENSES',                      'EXPENSE',  3, 3,  true, NOW()),
('acc_6004','6004','水电费 UTILITIES',                              'EXPENSE',  3, 4,  true, NOW()),
('acc_6005','6005','差旅招待费 TRAVEL & ENTERTAINMENT',             'EXPENSE',  3, 5,  true, NOW()),
('acc_6006','6006','折旧及摊销 DEPRECIATION & AMORTIZATION',        'EXPENSE',  3, 6,  true, NOW()),
('acc_6007','6007','专业服务费 PROFESSIONAL FEES',                  'EXPENSE',  3, 7,  true, NOW()),
('acc_6008','6008','银行手续费 BANK CHARGES',                       'EXPENSE',  3, 8,  true, NOW())
ON CONFLICT ("code") DO NOTHING;

-- Set parentId for child accounts
UPDATE "cos_accounts" SET "parentId" = 'acc_1100' WHERE "id" IN ('acc_1101','acc_1102');
UPDATE "cos_accounts" SET "parentId" = 'acc_1300' WHERE "id" IN ('acc_1301','acc_1302','acc_1303','acc_1399');
UPDATE "cos_accounts" SET "parentId" = 'acc_2300' WHERE "id" = 'acc_2301';
UPDATE "cos_accounts" SET "parentId" = 'acc_5000' WHERE "id" IN ('acc_5001','acc_5002','acc_5003');
UPDATE "cos_accounts" SET "parentId" = 'acc_6000' WHERE "id" IN ('acc_6001','acc_6002','acc_6003','acc_6004','acc_6005','acc_6006','acc_6007','acc_6008');
