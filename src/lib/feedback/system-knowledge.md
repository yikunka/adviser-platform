# Adviser Platform — System Knowledge

## Overview

Adviser is a TCSP (Trust and Company Services Provider) back-office management platform used by a licensed TCSP firm to manage client companies, KYC compliance, and financial accounting. It is a multi-platform system that also supports SFS Diamond (jewellery e-commerce) and CosmoCoat (cosmetics manufacturing) under the same infrastructure.

---

## Core Modules (Adviser TCSP)

### 1. Client Companies (`/admin/companies`)
Manages the portfolio of client companies incorporated/serviced by the firm.
- View and search all client companies
- Company details: name (English/Chinese), company code, registration number, incorporation date
- Assign staff members to companies
- Link companies to entity groups (corporate groups)
- Company documents: CI, BR, AA, NNC1, ROD, ROM, ROSC
- Annual filing tracker
- Shareholder change tracking
- Director change tracking
- Address change tracking

### 2. KYC Queue (`/admin/kyc`)
Manages Know Your Customer compliance workflows.
- Review pending KYC submissions from clients
- KYC status states: DRAFT → SUBMITTED → PENDING_INFO → APPROVED → REJECTED
- KYC covers both individual key persons and corporate entities
- Document collection and review
- Generate KYC compliance documents (Word/DOCX format)
- Key persons (directors, shareholders, beneficial owners) linked to companies

### 3. AML Screening (`/admin/aml`)
Anti-Money Laundering screening and monitoring.
- Automated AML checks against international sanction and PEP lists
- Supports XML, CSV, XLSX, JSON list formats
- Check results: CLEAR, WEAK_HIT, POTENTIAL_HIT, STRONG_HIT
- Alert review workflow: PENDING → FALSE_POSITIVE / CONFIRMED / ESCALATED
- Subjects: key persons (individuals) and companies (entities)
- Scheduled and manual checks
- KYC-triggered checks

### 4. Financial Accounting (`/admin/financial`)
Full double-entry accounting system compliant with HKFRS (Hong Kong Financial Reporting Standards).
- **Company workspace**: All financial data is isolated per client company
- **Chart of Accounts** (`/admin/financial/[companyId]/accounts`): Hierarchical account structure (up to 4 levels), account types: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE, CGS, CURRENT_ACCOUNT
- **Journal Entries** (`/admin/financial/[companyId]/journal`): Create balanced vouchers, review drafts, post entries. Statuses: DRAFT → POSTED / CANCELLED
- **General Ledger** (`/admin/financial/[companyId]/ledger`): Account activity with running balances, filterable by account type and period
- **HKFRS Reports** (`/admin/financial/[companyId]/reports`): Trial balance, income statement (P&L), balance sheet, cash flow statement
- Supports multiple companies simultaneously; each company has its own isolated chart of accounts and transactions
- Multi-currency with exchange rates

### 5. Invoices (`/admin/invoices`)
Service invoicing for TCSP services.
- Create and manage service invoices for clients
- Invoice statuses and payment tracking

### 6. Document Generation
Auto-generate compliance documents from system data:
- KYC compliance reports (DOCX)
- Due Diligence Reports (DDR)
- NAR1 (Annual Return to Companies Registry, Hong Kong)
- Appointment of directors documents

### 7. Admin Team Management (`/admin/team`)
Role-based access control for staff.
- User roles: SUPER_ADMIN, COMPLIANCE, STAFF, CLIENT
- Granular menu access per staff member
- Platform-level access control (which platforms each user can manage)
- Entity group assignments (restrict staff to specific client groups)

### 8. User/Client Accounts (`/admin/users`)
Client-facing account management.
- Manage client portal accounts
- Link clients to their companies
- Account activation and access

---

## Entity Group System
Companies are organised into entity groups (corporate families/groups). Staff can be restricted to specific entity groups. This enables multi-group management with proper data isolation.

---

## Multi-Platform Architecture
The system hosts multiple independent platforms:
| Platform | Purpose |
|---|---|
| **Adviser** | TCSP back-office (main platform) |
| **SFS Diamond** | Jewellery e-commerce admin (orders, invoices) |
| **CosmoCoat** | Cosmetics manufacturing ERP (products, recipes, production orders) |

---

## Technical Notes for Requirements
- Frontend: Next.js 15 with App Router, TypeScript, Tailwind CSS
- Database: PostgreSQL via Prisma ORM
- Authentication: NextAuth (session-based, JWT)
- All admin pages require staff-level login
- The platform supports both English and Chinese (zh-HK) interfaces
- Dark theme (brown/gold colour palette for Adviser admin)
