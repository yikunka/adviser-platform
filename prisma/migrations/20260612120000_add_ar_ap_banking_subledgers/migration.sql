-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('MANUAL', 'SALES_INVOICE', 'RECEIPT', 'CREDIT_NOTE', 'PURCHASE_BILL', 'BILL_PAYMENT', 'BANK', 'DEPRECIATION', 'CLOSING', 'RECURRING');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AccountMappingKey" AS ENUM ('AR_CONTROL', 'AP_CONTROL', 'SALES_REVENUE', 'OUTPUT_TAX', 'INPUT_TAX', 'BANK_DEFAULT', 'CASH_DEFAULT', 'PURCHASE_EXPENSE_DEFAULT', 'BANK_FEES', 'EXCHANGE_GAIN_LOSS', 'RETAINED_EARNINGS');

-- CreateEnum
CREATE TYPE "SalesInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "PurchaseBillStatus" AS ENUM ('DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "CreditNoteKind" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "FinPaymentDirection" AS ENUM ('RECEIPT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "FinPaymentStatus" AS ENUM ('POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "FinPaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "BankStatementLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "BankReconciliationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "adv_journal_entries" ADD COLUMN     "reversalOfId" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" "JournalSourceType" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "adv_journal_lines" ADD COLUMN     "costCenterId" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "exchangeRate" DECIMAL(12,6),
ADD COLUMN     "origCredit" DECIMAL(18,4),
ADD COLUMN     "origDebit" DECIMAL(18,4),
ADD COLUMN     "partyId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "sfs_diamond_spec_options" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sfs_order_step_attachments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "adv_parties" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameZh" TEXT,
    "isCustomer" BOOLEAN NOT NULL DEFAULT false,
    "isSupplier" BOOLEAN NOT NULL DEFAULT false,
    "isEmployee" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "taxNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'HKD',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" DECIMAL(18,2),
    "arAccountId" TEXT,
    "apAccountId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_fiscal_periods" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "adv_fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_account_mappings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" "AccountMappingKey" NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "adv_account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_doc_sequences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "adv_doc_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_cost_centers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_fin_projects" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_fin_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_sales_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "status" "SalesInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'HKD',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_sales_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "revenueAccountId" TEXT,

    CONSTRAINT "adv_sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_purchase_bills" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL DEFAULT '',
    "status" "PurchaseBillStatus" NOT NULL DEFAULT 'DRAFT',
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'HKD',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_purchase_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_purchase_bill_lines" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "expenseAccountId" TEXT,

    CONSTRAINT "adv_purchase_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_fin_payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "direction" "FinPaymentDirection" NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "status" "FinPaymentStatus" NOT NULL DEFAULT 'POSTED',
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" "FinPaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "bankAccountId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'HKD',
    "amount" DECIMAL(18,2) NOT NULL,
    "amountAllocated" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_fin_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "creditNoteId" TEXT,
    "salesInvoiceId" TEXT,
    "purchaseBillId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adv_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_fin_credit_notes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "kind" "CreditNoteKind" NOT NULL,
    "noteNo" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HKD',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "amountApplied" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "offsetAccountId" TEXT,
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_fin_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_bank_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL DEFAULT '',
    "accountNumber" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'HKD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_bank_statements" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "openingBalance" DECIMAL(18,2),
    "closingBalance" DECIMAL(18,2),
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adv_bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_bank_statement_lines" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "lineNum" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "BankStatementLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedLedgerId" TEXT,
    "reconciliationId" TEXT,

    CONSTRAINT "adv_bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adv_bank_reconciliations" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "statementBalance" DECIMAL(18,2) NOT NULL,
    "glBalance" DECIMAL(18,2) NOT NULL,
    "status" "BankReconciliationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adv_bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adv_parties_companyId_isCustomer_isActive_idx" ON "adv_parties"("companyId", "isCustomer", "isActive");

-- CreateIndex
CREATE INDEX "adv_parties_companyId_isSupplier_isActive_idx" ON "adv_parties"("companyId", "isSupplier", "isActive");

-- CreateIndex
CREATE INDEX "adv_parties_name_idx" ON "adv_parties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "adv_parties_companyId_code_key" ON "adv_parties"("companyId", "code");

-- CreateIndex
CREATE INDEX "adv_fiscal_periods_companyId_status_idx" ON "adv_fiscal_periods"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "adv_fiscal_periods_companyId_period_key" ON "adv_fiscal_periods"("companyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "adv_account_mappings_companyId_key_key" ON "adv_account_mappings"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "adv_doc_sequences_companyId_docType_periodKey_key" ON "adv_doc_sequences"("companyId", "docType", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "adv_cost_centers_companyId_code_key" ON "adv_cost_centers"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "adv_fin_projects_companyId_code_key" ON "adv_fin_projects"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "adv_sales_invoices_journalEntryId_key" ON "adv_sales_invoices"("journalEntryId");

-- CreateIndex
CREATE INDEX "adv_sales_invoices_companyId_status_dueDate_idx" ON "adv_sales_invoices"("companyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "adv_sales_invoices_partyId_status_idx" ON "adv_sales_invoices"("partyId", "status");

-- CreateIndex
CREATE INDEX "adv_sales_invoices_issueDate_idx" ON "adv_sales_invoices"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "adv_sales_invoices_companyId_invoiceNo_key" ON "adv_sales_invoices"("companyId", "invoiceNo");

-- CreateIndex
CREATE INDEX "adv_sales_invoice_lines_invoiceId_sortOrder_idx" ON "adv_sales_invoice_lines"("invoiceId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "adv_purchase_bills_journalEntryId_key" ON "adv_purchase_bills"("journalEntryId");

-- CreateIndex
CREATE INDEX "adv_purchase_bills_companyId_status_dueDate_idx" ON "adv_purchase_bills"("companyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "adv_purchase_bills_partyId_status_idx" ON "adv_purchase_bills"("partyId", "status");

-- CreateIndex
CREATE INDEX "adv_purchase_bills_billDate_idx" ON "adv_purchase_bills"("billDate");

-- CreateIndex
CREATE UNIQUE INDEX "adv_purchase_bills_companyId_billNo_key" ON "adv_purchase_bills"("companyId", "billNo");

-- CreateIndex
CREATE INDEX "adv_purchase_bill_lines_billId_sortOrder_idx" ON "adv_purchase_bill_lines"("billId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "adv_fin_payments_journalEntryId_key" ON "adv_fin_payments"("journalEntryId");

-- CreateIndex
CREATE INDEX "adv_fin_payments_companyId_direction_paymentDate_idx" ON "adv_fin_payments"("companyId", "direction", "paymentDate");

-- CreateIndex
CREATE INDEX "adv_fin_payments_partyId_idx" ON "adv_fin_payments"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "adv_fin_payments_companyId_paymentNo_key" ON "adv_fin_payments"("companyId", "paymentNo");

-- CreateIndex
CREATE INDEX "adv_payment_allocations_paymentId_idx" ON "adv_payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "adv_payment_allocations_creditNoteId_idx" ON "adv_payment_allocations"("creditNoteId");

-- CreateIndex
CREATE INDEX "adv_payment_allocations_salesInvoiceId_idx" ON "adv_payment_allocations"("salesInvoiceId");

-- CreateIndex
CREATE INDEX "adv_payment_allocations_purchaseBillId_idx" ON "adv_payment_allocations"("purchaseBillId");

-- CreateIndex
CREATE UNIQUE INDEX "adv_fin_credit_notes_journalEntryId_key" ON "adv_fin_credit_notes"("journalEntryId");

-- CreateIndex
CREATE INDEX "adv_fin_credit_notes_companyId_kind_status_idx" ON "adv_fin_credit_notes"("companyId", "kind", "status");

-- CreateIndex
CREATE INDEX "adv_fin_credit_notes_partyId_idx" ON "adv_fin_credit_notes"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "adv_fin_credit_notes_companyId_noteNo_key" ON "adv_fin_credit_notes"("companyId", "noteNo");

-- CreateIndex
CREATE INDEX "adv_bank_accounts_companyId_isActive_idx" ON "adv_bank_accounts"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "adv_bank_accounts_companyId_name_key" ON "adv_bank_accounts"("companyId", "name");

-- CreateIndex
CREATE INDEX "adv_bank_statements_bankAccountId_idx" ON "adv_bank_statements"("bankAccountId");

-- CreateIndex
CREATE INDEX "adv_bank_statement_lines_statementId_lineNum_idx" ON "adv_bank_statement_lines"("statementId", "lineNum");

-- CreateIndex
CREATE INDEX "adv_bank_statement_lines_status_idx" ON "adv_bank_statement_lines"("status");

-- CreateIndex
CREATE INDEX "adv_bank_statement_lines_matchedLedgerId_idx" ON "adv_bank_statement_lines"("matchedLedgerId");

-- CreateIndex
CREATE INDEX "adv_bank_reconciliations_bankAccountId_status_idx" ON "adv_bank_reconciliations"("bankAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "adv_journal_entries_reversalOfId_key" ON "adv_journal_entries"("reversalOfId");

-- CreateIndex
CREATE INDEX "adv_journal_entries_sourceType_sourceId_idx" ON "adv_journal_entries"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "adv_journal_lines_partyId_idx" ON "adv_journal_lines"("partyId");

-- AddForeignKey
ALTER TABLE "adv_journal_entries" ADD CONSTRAINT "adv_journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "adv_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_journal_lines" ADD CONSTRAINT "adv_journal_lines_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "adv_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_journal_lines" ADD CONSTRAINT "adv_journal_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "adv_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_journal_lines" ADD CONSTRAINT "adv_journal_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "adv_fin_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_parties" ADD CONSTRAINT "adv_parties_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_parties" ADD CONSTRAINT "adv_parties_arAccountId_fkey" FOREIGN KEY ("arAccountId") REFERENCES "adv_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_parties" ADD CONSTRAINT "adv_parties_apAccountId_fkey" FOREIGN KEY ("apAccountId") REFERENCES "adv_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fiscal_periods" ADD CONSTRAINT "adv_fiscal_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fiscal_periods" ADD CONSTRAINT "adv_fiscal_periods_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_account_mappings" ADD CONSTRAINT "adv_account_mappings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_account_mappings" ADD CONSTRAINT "adv_account_mappings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "adv_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_doc_sequences" ADD CONSTRAINT "adv_doc_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_cost_centers" ADD CONSTRAINT "adv_cost_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_projects" ADD CONSTRAINT "adv_fin_projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_sales_invoices" ADD CONSTRAINT "adv_sales_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_sales_invoices" ADD CONSTRAINT "adv_sales_invoices_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "adv_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_sales_invoices" ADD CONSTRAINT "adv_sales_invoices_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "adv_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_sales_invoices" ADD CONSTRAINT "adv_sales_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_sales_invoice_lines" ADD CONSTRAINT "adv_sales_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "adv_sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_sales_invoice_lines" ADD CONSTRAINT "adv_sales_invoice_lines_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "adv_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_purchase_bills" ADD CONSTRAINT "adv_purchase_bills_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_purchase_bills" ADD CONSTRAINT "adv_purchase_bills_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "adv_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_purchase_bills" ADD CONSTRAINT "adv_purchase_bills_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "adv_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_purchase_bills" ADD CONSTRAINT "adv_purchase_bills_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_purchase_bill_lines" ADD CONSTRAINT "adv_purchase_bill_lines_billId_fkey" FOREIGN KEY ("billId") REFERENCES "adv_purchase_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_purchase_bill_lines" ADD CONSTRAINT "adv_purchase_bill_lines_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "adv_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_payments" ADD CONSTRAINT "adv_fin_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_payments" ADD CONSTRAINT "adv_fin_payments_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "adv_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_payments" ADD CONSTRAINT "adv_fin_payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "adv_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_payments" ADD CONSTRAINT "adv_fin_payments_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "adv_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_payments" ADD CONSTRAINT "adv_fin_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_payment_allocations" ADD CONSTRAINT "adv_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "adv_fin_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_payment_allocations" ADD CONSTRAINT "adv_payment_allocations_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "adv_fin_credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_payment_allocations" ADD CONSTRAINT "adv_payment_allocations_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "adv_sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_payment_allocations" ADD CONSTRAINT "adv_payment_allocations_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "adv_purchase_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_credit_notes" ADD CONSTRAINT "adv_fin_credit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_credit_notes" ADD CONSTRAINT "adv_fin_credit_notes_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "adv_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_credit_notes" ADD CONSTRAINT "adv_fin_credit_notes_offsetAccountId_fkey" FOREIGN KEY ("offsetAccountId") REFERENCES "adv_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_credit_notes" ADD CONSTRAINT "adv_fin_credit_notes_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "adv_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_fin_credit_notes" ADD CONSTRAINT "adv_fin_credit_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_bank_accounts" ADD CONSTRAINT "adv_bank_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_bank_accounts" ADD CONSTRAINT "adv_bank_accounts_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "adv_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_bank_statements" ADD CONSTRAINT "adv_bank_statements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "adv_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_bank_statements" ADD CONSTRAINT "adv_bank_statements_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_bank_statement_lines" ADD CONSTRAINT "adv_bank_statement_lines_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "adv_bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_bank_statement_lines" ADD CONSTRAINT "adv_bank_statement_lines_matchedLedgerId_fkey" FOREIGN KEY ("matchedLedgerId") REFERENCES "adv_ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_bank_statement_lines" ADD CONSTRAINT "adv_bank_statement_lines_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "adv_bank_reconciliations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_bank_reconciliations" ADD CONSTRAINT "adv_bank_reconciliations_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "adv_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adv_bank_reconciliations" ADD CONSTRAINT "adv_bank_reconciliations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

