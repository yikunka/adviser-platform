-- Baseline migration: full schema from `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.
-- Replaces incremental-only migrations so **empty PostgreSQL** can run `migrate deploy` (greenfield installs).
-- If you previously applied older migration names locally, migrate deploy will mismatch — drop databases or baseline manually.


-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'STAFF', 'COMPLIANCE', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'DORMANT', 'STRUCK_OFF', 'DEREGISTERED');

-- CreateEnum
CREATE TYPE "ServiceTier" AS ENUM ('BASIC', 'PROFESSIONAL', 'PREMIUM');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_INFO', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CI', 'BR', 'ROD', 'ROM', 'ROSC', 'AR', 'NAR1', 'DDR', 'RESOLUTION', 'MINUTES', 'KYC', 'OTHER');

-- CreateEnum
CREATE TYPE "AMLEntityType" AS ENUM ('INDIVIDUAL', 'ENTITY');

-- CreateEnum
CREATE TYPE "AMLListFormat" AS ENUM ('XML', 'CSV', 'XLSX', 'JSON');

-- CreateEnum
CREATE TYPE "AMLCheckResult" AS ENUM ('CLEAR', 'WEAK_HIT', 'POTENTIAL_HIT', 'STRONG_HIT');

-- CreateEnum
CREATE TYPE "AMLCheckTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'KYC_SUBMIT');

-- CreateEnum
CREATE TYPE "AMLAlertResolution" AS ENUM ('PENDING', 'FALSE_POSITIVE', 'CONFIRMED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "AMLSubjectType" AS ENUM ('KEY_PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DDRRecommendation" AS ENUM ('RECOMMEND', 'NOT_RECOMMEND', 'FURTHER_REVIEW');

-- CreateEnum
CREATE TYPE "ShareholderChangeType" AS ENUM ('TRANSFER', 'NEW_ALLOTMENT', 'REDEMPTION', 'NAME_CHANGE');

-- CreateEnum
CREATE TYPE "ShareClass" AS ENUM ('ORDINARY', 'PREFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ShareTransactionType" AS ENUM ('ALLOTMENT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "DirectorIDType" AS ENUM ('HKID', 'PASSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DirectorStatus" AS ENUM ('ACTIVE', 'CEASED');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'TRANSFERRED_OUT');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FilingStatus" AS ENUM ('NOT_STARTED', 'IN_PREPARATION', 'FILED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('INCORPORATION', 'REGISTERED_ADDRESS', 'ANNUAL_RETURN', 'ACCOUNTING', 'ADVISORY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('KYC_STATUS_CHANGE', 'AML_ALERT', 'ANNUAL_RETURN_DUE', 'DOCUMENT_READY', 'GENERAL');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('EMPLOYED', 'SELF_EMPLOYED', 'RETIRED', 'UNEMPLOYED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT,
    "companyNumber" TEXT,
    "dateOfIncorporation" TIMESTAMP(3),
    "registeredAddress" TEXT,
    "businessNature" TEXT,
    "financialYearEndMonth" INTEGER,
    "annualReturnDate" TIMESTAMP(3),
    "businessRegNumber" TEXT,
    "brExpiryDate" TIMESTAMP(3),
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "serviceTier" "ServiceTier" NOT NULL DEFAULT 'BASIC',
    "internalNotes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "clientUserId" TEXT,
    "pendingClientEmail" TEXT,
    "assignedStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directors" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT,
    "dateOfAppointment" TIMESTAMP(3) NOT NULL,
    "dateAsReserve" TIMESTAMP(3),
    "dateOfCessation" TIMESTAMP(3),
    "addressForService" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfBirth" TEXT,
    "nationality" TEXT,
    "idType" "DirectorIDType",
    "idNumber" TEXT,
    "countryOfIssuance" TEXT,
    "isCorporation" BOOLEAN NOT NULL DEFAULT false,
    "corpRegNumber" TEXT,
    "corpRegPlace" TEXT,
    "status" "DirectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT,
    "shareClass" "ShareClass" NOT NULL DEFAULT 'ORDINARY',
    "registeredAddress" TEXT NOT NULL,
    "occupation" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_transactions" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "transactionType" "ShareTransactionType" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "allotmentTransferNo" TEXT,
    "sharesAcquired" INTEGER,
    "sharesTransferred" INTEGER,
    "sharesHeld" INTEGER NOT NULL,
    "certificateNo" TEXT,
    "distinctiveNosFrom" INTEGER,
    "distinctiveNosTo" INTEGER,
    "amountPaid" DECIMAL(18,2),
    "certificateSurrendered" TEXT,
    "certificateSurrenderedShares" INTEGER,
    "balanceCertificateNo" TEXT,
    "balanceCertificateShares" INTEGER,
    "balanceDistinctiveNosFrom" INTEGER,
    "balanceDistinctiveNosTo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "significant_controllers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT,
    "correspondenceAddress" TEXT,
    "idType" "DirectorIDType",
    "idPassportNo" TEXT,
    "issuingCountry" TEXT,
    "natureOfControl" TEXT,
    "becomingDate" TIMESTAMP(3) NOT NULL,
    "cessationDate" TIMESTAMP(3),
    "isLegalEntity" BOOLEAN NOT NULL DEFAULT false,
    "legalEntityRegNo" TEXT,
    "legalEntityGovLaw" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "significant_controllers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designated_representatives" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "capacity" TEXT,
    "telFax" TEXT,
    "becomingDate" TIMESTAMP(3) NOT NULL,
    "cessationDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designated_representatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_persons" (
    "id" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "titlePrefix" TEXT,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "placeOfIssue" TEXT,
    "placeOfBirth" TEXT,
    "idExpiryDate" TIMESTAMP(3),
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "homeAddress" TEXT,
    "contactAddress" TEXT,
    "homePhone" TEXT,
    "workPhone" TEXT,
    "mobile" TEXT,
    "wechat" TEXT,
    "email" TEXT,
    "isUsCitizen" BOOLEAN,
    "isPep" BOOLEAN,
    "emergencyContact" TEXT,
    "employmentStatus" "EmploymentStatus",
    "employerName" TEXT,
    "employerAddress" TEXT,
    "businessNatures" TEXT[],
    "position" TEXT,
    "workingYears" INTEGER,
    "sourceOfFunds" TEXT,
    "sourcesOfWealth" TEXT[],
    "annualIncome" TEXT,
    "netAssetValue" TEXT,
    "assetItems" TEXT[],
    "declarationSigned" BOOLEAN NOT NULL DEFAULT false,
    "signatureName" TEXT,
    "declarationDate" TIMESTAMP(3),
    "kycStatus" "KYCStatus" NOT NULL DEFAULT 'DRAFT',
    "kycApprovedById" TEXT,
    "kycApprovedAt" TIMESTAMP(3),
    "kycExpiryDate" TIMESTAMP(3),
    "kycRejectionReason" TEXT,
    "amlLastChecked" TIMESTAMP(3),
    "amlRiskLevel" "RiskLevel",
    "amlAlert" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "keyPersonId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_key_persons" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "keyPersonId" TEXT NOT NULL,
    "roles" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_key_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_sources" (
    "id" TEXT NOT NULL,
    "seqNo" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "format" "AMLListFormat" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFetched" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aml_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_records" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "listVersionDate" TIMESTAMP(3) NOT NULL,
    "entityType" "AMLEntityType" NOT NULL,
    "primaryName" TEXT NOT NULL,
    "aliases" TEXT[],
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "gender" TEXT,
    "placeOfBirth" TEXT,
    "addresses" JSONB,
    "idNumbers" JSONB,
    "listingReason" TEXT,
    "listingDate" TIMESTAMP(3),
    "rawData" JSONB,
    "recordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_checks" (
    "id" TEXT NOT NULL,
    "subjectType" "AMLSubjectType" NOT NULL,
    "keyPersonId" TEXT,
    "companyId" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" "AMLCheckTrigger" NOT NULL,
    "triggeredById" TEXT,
    "result" "AMLCheckResult" NOT NULL,
    "matches" JSONB,

    CONSTRAINT "aml_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_alerts" (
    "id" TEXT NOT NULL,
    "amlRecordId" TEXT NOT NULL,
    "subjectType" "AMLSubjectType" NOT NULL,
    "keyPersonId" TEXT,
    "companyId" TEXT,
    "matchScore" DOUBLE PRECISION,
    "result" "AMLCheckResult" NOT NULL,
    "resolution" "AMLAlertResolution" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "due_diligence_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallRiskLevel" "RiskLevel",
    "recommendation" "DDRRecommendation",
    "recommendationNote" TEXT,
    "recommendedById" TEXT,
    "recommendedAt" TIMESTAMP(3),
    "approvalStatus" BOOLEAN,
    "approvalNote" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "due_diligence_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessment_answers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ddrId" TEXT,
    "questionKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shareholder_changes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "changeType" "ShareholderChangeType" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "transferorId" TEXT,
    "transfereeId" TEXT,
    "numberOfShares" INTEGER,
    "shareClass" TEXT,
    "consideration" DECIMAL(18,2),
    "filedWithCR" BOOLEAN NOT NULL DEFAULT false,
    "filingDate" TIMESTAMP(3),
    "filingReference" TEXT,
    "processedById" TEXT,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shareholder_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shareholder_change_documents" (
    "changeId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "shareholder_change_documents_pkey" PRIMARY KEY ("changeId","documentId")
);

-- CreateTable
CREATE TABLE "address_changes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "previousAddress" TEXT NOT NULL,
    "newAddress" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "noticeToCR" BOOLEAN NOT NULL DEFAULT false,
    "nnd1FilingDate" TIMESTAMP(3),
    "nnd1Reference" TEXT,
    "processedById" TEXT,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_change_documents" (
    "changeId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "address_change_documents_pkey" PRIMARY KEY ("changeId","documentId")
);

-- CreateTable
CREATE TABLE "annual_filings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "annualReturnDate" TIMESTAMP(3) NOT NULL,
    "financialYearEnd" TIMESTAMP(3),
    "filingDeadline" TIMESTAMP(3),
    "status" "FilingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "filedDate" TIMESTAMP(3),
    "filingReference" TEXT,
    "processedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annual_filing_documents" (
    "filingId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "annual_filing_documents_pkey" PRIMARY KEY ("filingId","documentId")
);

-- CreateTable
CREATE TABLE "service_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "orderType" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "formData" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "companyId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedEntityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "companies_companyNumber_key" ON "companies"("companyNumber");

-- CreateIndex
CREATE INDEX "companies_pendingClientEmail_idx" ON "companies"("pendingClientEmail");

-- CreateIndex
CREATE INDEX "key_persons_submittedByUserId_idx" ON "key_persons"("submittedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "company_key_persons_companyId_keyPersonId_key" ON "company_key_persons"("companyId", "keyPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "aml_sources_seqNo_key" ON "aml_sources"("seqNo");

-- CreateIndex
CREATE INDEX "aml_records_primaryName_idx" ON "aml_records"("primaryName");

-- CreateIndex
CREATE UNIQUE INDEX "aml_records_sourceId_recordHash_key" ON "aml_records"("sourceId", "recordHash");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessment_answers_companyId_ddrId_questionKey_key" ON "risk_assessment_answers"("companyId", "ddrId", "questionKey");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directors" ADD CONSTRAINT "directors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_transactions" ADD CONSTRAINT "share_transactions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "significant_controllers" ADD CONSTRAINT "significant_controllers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designated_representatives" ADD CONSTRAINT "designated_representatives_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_persons" ADD CONSTRAINT "key_persons_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_persons" ADD CONSTRAINT "key_persons_kycApprovedById_fkey" FOREIGN KEY ("kycApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_key_persons" ADD CONSTRAINT "company_key_persons_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_key_persons" ADD CONSTRAINT "company_key_persons_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_records" ADD CONSTRAINT "aml_records_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "aml_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_checks" ADD CONSTRAINT "aml_checks_keyPersonId_fkey" FOREIGN KEY ("keyPersonId") REFERENCES "key_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_checks" ADD CONSTRAINT "aml_checks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_checks" ADD CONSTRAINT "aml_checks_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_alerts" ADD CONSTRAINT "aml_alerts_amlRecordId_fkey" FOREIGN KEY ("amlRecordId") REFERENCES "aml_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_alerts" ADD CONSTRAINT "aml_alerts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_diligence_reports" ADD CONSTRAINT "due_diligence_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessment_answers" ADD CONSTRAINT "risk_assessment_answers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessment_answers" ADD CONSTRAINT "risk_assessment_answers_ddrId_fkey" FOREIGN KEY ("ddrId") REFERENCES "due_diligence_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shareholder_changes" ADD CONSTRAINT "shareholder_changes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shareholder_changes" ADD CONSTRAINT "shareholder_changes_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shareholder_change_documents" ADD CONSTRAINT "shareholder_change_documents_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "shareholder_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shareholder_change_documents" ADD CONSTRAINT "shareholder_change_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_changes" ADD CONSTRAINT "address_changes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_changes" ADD CONSTRAINT "address_changes_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_change_documents" ADD CONSTRAINT "address_change_documents_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "address_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_change_documents" ADD CONSTRAINT "address_change_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_filings" ADD CONSTRAINT "annual_filings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_filings" ADD CONSTRAINT "annual_filings_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_filing_documents" ADD CONSTRAINT "annual_filing_documents_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "annual_filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_filing_documents" ADD CONSTRAINT "annual_filing_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
