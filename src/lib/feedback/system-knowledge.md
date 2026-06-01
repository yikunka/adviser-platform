# Adviser Platform — System Knowledge

## Overview

A multi-platform back-office system operated by a licensed TCSP (Trust and Company Services Provider) firm. Three independent platforms share one Next.js codebase and one PostgreSQL database:

| Platform | URL prefix | DB prefix | Purpose |
|---|---|---|---|
| **Adviser** | `/[locale]/` | `adv_` | TCSP back-office (main platform) |
| **SFS Diamond** | `/sfsdiamond/` | `sfs_` | Memorial diamond jewellery e-commerce |
| **CosmoCoat** | `/cosmocoat/` | `cos_` | Cosmetics manufacturing ERP |

Admin console is at `/[locale]/admin/`. Roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`, `CLIENT`. Staff access is further restricted by per-menu permission keys and per-platform flags.

---

## Adviser Admin Console

### 1. Dashboard (`/admin`)
Key metrics at a glance: active companies count, pending KYC submissions, open AML alerts, annual returns due within 30 days. Each card links to the relevant module.

### 2. Companies (`/admin/companies`)
Manages the full portfolio of client companies.
- List with search (name / code / registration number), status badge, assigned client, annual return date, financial-module toggle
- Company statuses: `ACTIVE`, `DORMANT`, `STRUCK_OFF`, `DEREGISTERED`
- Company types: `HONG_KONG`, `BVI`, `CAYMAN`, `MARSHALL`
- Auto-generates company codes by type: `AA#####` (HK), `BV#####` (BVI), `CA#####` (Cayman), `MS#####` (Marshall)
- Create new company; assign client user or pending-client email; assign staff

**Company detail sub-pages** (`/admin/companies/[id]/...`):
- **Directors** — Register of Directors (ROD): add / edit / remove; date of appointment / cessation
- **Members** — Register of Members (ROM): shareholders with share class, share count, transfer history
- **Significant Controllers** — ROSC entries
- **Designated Representatives** — company representatives
- **File Cases** — document groupings; upload / download documents (CI, BR, AA, NNC1, ROD, ROM, ROSC, AR, NAR1, AUDIT_TAX, DDR, RESOLUTION, MINUTES, KYC, OTHER)
- **Address Changes** — registered address change tracking; NND1 filing status
- **Shareholder Changes** — ownership change tracking with filing status
- **NAR1** — Annual return generation and sync with Companies Registry data
- **Annual Filings** — status: `NOT_STARTED`, `IN_PREPARATION`, `FILED`, `OVERDUE`
- **Document Analysis** — batch AI-assisted document review

Company-level staff access: multiple staff users can be assigned to a company via `company_staff_assignments`.

### 3. KYC Queue (`/admin/kyc`)
Know Your Customer compliance workflow.
- List with search; columns: KYC code, name, status, PEP indicator, AML risk level, approval date
- KYC statuses: `DRAFT` → `SUBMITTED` → `PENDING_INFO` → `APPROVED` / `REJECTED`
- Each KYC record captures: personal info, ID type/number, address, employment, business nature, source of funds/wealth, asset declarations, declaration date
- Upload and verify supporting documents (proof of ID, proof of address, etc.)
- Approve or reject with written reasons
- View linked AML alerts directly from the KYC record
- Export KYC data
- Generate compliance documents (DOCX): Due Diligence Reports (DDR), KYC summaries

### 4. AML Screening (`/admin/aml`)
Anti-Money Laundering screening and alert management.
- Subjects: individuals (key persons) and entities (companies)
- Check result levels: `CLEAR`, `WEAK_HIT`, `POTENTIAL_HIT`, `STRONG_HIT`
- Alert resolution workflow: `PENDING` → `FALSE_POSITIVE` / `CONFIRMED` / `ESCALATED`
- Alert details: match score, aliases, addresses, ID numbers, listing reason and date, source list info
- Review: add notes, mark resolution
- Data sources: XML, CSV, XLSX, JSON list formats; each source tracks last fetch date
- Trigger modes: manual (screen a subject on demand), KYC-triggered (auto-runs on KYC submission), scheduled cron
- Ingest new AML lists from URL or local file

### 5. Financial Accounting (`/admin/financial`)
Full double-entry accounting system per client company, compliant with HKFRS.

**Company selection**: select a client company (or consolidated report group) before accessing financial sub-pages. Selection is persisted in `localStorage`. Confirmed with a two-step OK button.

Sub-pages (all scoped to a selected company or at `/admin/financial/[companyId]/`):

- **Chart of Accounts** (`/accounts`): hierarchical accounts up to 4 levels; account types: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`, `CGS`, `CURRENT_ACCOUNT`; create / edit / delete; system accounts are locked; account creation supports opening debit or opening credit balances by period
- **Journal Entries** (`/journal`): create balanced vouchers with multi-line debits/credits; statuses: `DRAFT` → `POSTED` / `CANCELLED`; support attachments; post to ledger; reverse entries; grouped by period (YYYY-MM); Excel import for historical journal entries. Import accepts either line-based rows (`Voucher No`, `Date`, `Description`, `Account Code`, `Debit`, `Credit`) or paired rows (`Date`, `Description`, `Debit Account Code`, `Credit Account Code`, `Amount`). Imported entries are saved as Pending/DRAFT for review before posting.
- **General Ledger** (`/ledger`): account activity with running balances; entries are grouped by account code and sorted by date within each account; filter by account, account type, period, date range
- **HKFRS Reports** (`/reports`): trial balance, income statement (P&L), balance sheet, cash flow statement; supports exporting all four statements into one Excel workbook; support multi-currency with exchange rates (HKD / USD / RMB)
- **Consolidated Report Groups** (on selector page): named portfolios grouping multiple companies for consolidated reporting; create / delete groups; groups do not own journal entries (reporting only)

Financial module can be enabled/disabled per company via the `financialEnabled` flag. The financial admin UI is localized in Chinese.

### 6. Invoices (`/admin/invoices`)
Service invoicing for TCSP professional fees.
- List with search, status filter
- Invoice statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Create invoices with multiple line items (description, quantity, unit price, tax)
- Edit DRAFT invoices; status changes
- Generate and download PDF
- Link invoices to client companies

### 7. Team Management (`/admin/team`)
Staff access control.
- Roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`
- Per-staff platform access flags (Adviser / SFS Diamond / CosmoCoat)
- Granular admin-menu permission keys (companies, kyc, aml, financial, invoices, team, feedback, sfs-orders, sfs-invoices, cosmocoat-*)
- Legacy mode: no restrictions; new mode: explicit per-menu grants
- Create / edit / deactivate staff accounts

### 8. User Accounts (`/admin/users`)
Client portal account management.
- View and manage `CLIENT` role accounts
- Link clients to their companies
- Account activation; email verification status

### 9. Requirements / Feedback (`/admin/feedback`)
AI-powered feature request management. **SUPER_ADMIN only.**
- Lists all submitted feature requests with title (LLM-generated), summary, priority, status, submission date
- Statuses: `PENDING`, `IN_PROGRESS`, `DONE`, `REJECTED`
- View full conversation history for each submission
- **Model Config** tab: configure the LLM provider (Anthropic / DeepSeek / 阿里百炼), model, and API key used for the "提交需求" widget
- The "提交需求" floating button appears on every admin page; it opens a chat dialog that clarifies the request and saves a structured summary

---

## Adviser Client Portal

Routes under `/[locale]/(client)/`. Accessible by `CLIENT` role users only.

### Dashboard (`/dashboard`)
- Summary cards for assigned companies with quick links
- KYC status badge (own submission status)
- Last 5 unread notifications
- Upcoming annual return dates

### My Companies (`/companies`)
- List of companies linked to the logged-in client
- Click through to company detail: directors, members, documents, shareholder/address changes, filing status

### KYC Submission (`/kyc`)
- Progressive form: personal info → ID → address → employment → source of funds/wealth → asset declarations → document upload → submit
- View current status and approval/rejection reason
- Re-submit after `PENDING_INFO` request

### Documents (`/documents`)
- Upload and download company documents by type
- View metadata: upload date, file size, version

### Service Orders (`/orders`)
- Service types: `INCORPORATION`, `REGISTERED_ADDRESS`, `ANNUAL_RETURN`, `ACCOUNTING`, `ADVISORY`
- Statuses: `PENDING`, `PROCESSING`, `COMPLETED`, `CANCELLED`
- Create new service request; track progress

### Notifications
- Types: `KYC_STATUS_CHANGE`, `AML_ALERT`, `ANNUAL_RETURN_DUE`, `DOCUMENT_READY`, `GENERAL`
- Mark as read / unread

---

## SFS Diamond Platform

Memorial diamond jewellery service (lab-grown diamonds from cremation remains). Public site at `sfsdiamond.com`; admin under Adviser console.

### Public Pages (`/sfsdiamond/`)
- **Home**: hero, process overview, team, four value pillars, Eternity Ring 3D visualization
- **About**: company background, mission, vision
- **Technology**: diamond creation process (CVD growth explained)
- **Memorial Diamonds**: product showcase
- **Q&A**: FAQ
- **Order** (`/order`): order placement form
- **Order Success** (`/order/success`): confirmation page
- **Dashboard** (authenticated): client's orders with milestone progress
- **Dashboard Detail** (`/dashboard/[id]`): specific order status and phase timeline

### SFS Orders Admin (`/admin/sfs-orders`)
Order lifecycle management for memorial diamond commissions.
- List with search (client name / email / order ID); columns: status, sample code, memorial name, client, source type, colour, diamond count, creation date
- Order statuses: `PENDING` → `QUOTED` → `CONFIRMED` → `COMPLETED` / `CANCELLED`
- Production phase tracking with milestone dates:
  1. Sample received
  2. Chemical transformation start / end
  3. CVD growth start / end
  4. Crafting start / end
  5. IGI certification
  6. Jewellery setting start / end
  7. Packaging
  8. Delivery
- Edit order details, update milestone dates, add admin notes
- Order steps: create / update / complete sub-tasks within phases

### SFS Invoices Admin (`/admin/sfs-invoices`)
- Invoices linked to SFS orders
- Statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Create from order; edit DRAFT; generate and download PDF

---

## CosmoCoat Platform

Cosmetics manufacturing ERP. Public product site at `/cosmocoat/`; manufacturing management under Adviser admin console.

### Public Pages (`/cosmocoat/`)
Home, Products catalog, Product detail, About, Supporting.

### Factory Products (`/admin/cosmocoat-factory-products`)
Finished goods produced by the factory.
- Fields: product code, name, category, unit (kg), unit price, viscosity, current recipe, linked recipes, sort order
- Assign / change current recipe; link multiple recipe candidates
- Search / filter by name or category

### Product Categories (`/admin/cosmocoat-product-categories`)
Hierarchical category tree (up to 3 levels) for the website catalog.
- Create parent / child categories; upload category image; set slug and active status; reorder

### Raw Materials (`/admin/cosmocoat-raw-materials`)
Purchasing and sourcing registry.
- Fields: material code, production code, attribute code, category, name
- Dual supplier support: primary and secondary (name, package size kg, price/kg, tax flag, freight flag, notes)
- Attach and download TDS (Technical Data Sheet) and MSDS (Material Safety Data Sheet) files
- Bulk import from file

### Recipes (`/admin/cosmocoat-recipes`)
Product formulation management.
- Fields: recipe code, name, category, batch quantity, unit cost
- Line items: raw materials or component recipes (nested), with quantity, unit price, percentage
- Automatic cost calculation; refresh prices from latest material pricing
- Link to factory products; mark recipe as active/used
- Print recipe: prints complete recipe sheet (materials, quantities, percentages, costs, production requirements)
- Packaging requirements field has quick-select presets: 200目、300目、400目、色装机
- Material rows can be reordered by drag-and-drop; new order is auto-saved immediately

### Color Matching Formulas (`/admin/cosmocoat-color-formulas`)
Custom color formulations for specific customers or products.
- Categories shown to users: PU, 色漆, 烤漆; stored enum identifiers remain `PU`, `BAKING_PAINT`, `HT_BAKING_PAINT` (legacy `LT_BAKING_PAINT` records may still exist)
- Scope: product-specific (linked to a factory product) or category-wide
- Fields: formula code, name, source recipe, color code (real-time PANTONE / hex color preview swatch next to the input), customer name, target color, batch quantity
- Line items: raw material library entries, Sol semifinished inventory entries, or manual blank/custom material rows, with quantity, percentage, unit price
- First line item is always the pinned "适用产品" row when a factory product is linked; it cannot be deleted
- Material picker supports multi-type filtering for AD, SO, Sol semifinished, DY, CO, CA, CC; a "参考配方" dropdown filters the picker to only materials used in a specific existing recipe
- Clicking "新建配方" while a product filter is active pre-fills that product in the new formula form
- Generate from factory product template: creates a linked formula with only an applicable-product row in material details; it does not auto-expand the product's full material list
- PU 同步 button (visible on PU category, SUPER_ADMIN only): deletes all PU color formulas and recreates them from PU factory products with full recipe item expansion

### Production Orders (`/admin/cosmocoat-production-orders`)
Manufacturing batch tracking.
- Fields: order code, factory product, recipe, total weight, batch number
- Statuses: `DRAFT` → `IN_PROGRESS` → `COMPLETED`
- Line items: raw materials with required weight and actual weight used
- Print production order: A4 sheet with enlarged text, no page header, and a material table that omits material names while keeping material codes, ratios, required weight, and actual weight
- Production / quality / packaging notes and requirements
- Output: creates semifinished product inventory entries on completion

### Semifinished Products (`/admin/cosmocoat-product-semifinished`)
Intermediate inventory from production.
- Fields: code, name, category (Sol.), stock quantity (kg), unit price, source production order
- Used as components in recipes

### Process Kits (`/admin/cosmocoat-process-kits`)
Product application method documentation (產品配套工藝書).
- Fields: kit code, name, status, materials list, performance standards, usage notes
- Performance standards are multi-select checkboxes: 百格(5B), water-boiling tests (80C30M/60M, 100C30M/60M/120M), RCA (30/50/100/150/200), hardness (B/HB/H/2H), alcohol resistance (99%100/75%100), MEK(100), high temperature/humidity (65C85%24H), salt spray (5%24H/48H)
- Kit statuses: `DRAFT` → `ACTIVE` → `ARCHIVED`
- Products in kit: each product has a usage method and notes
- Test records: type (`PERFORMANCE`, `DURABILITY`, `ADHESION`, `COLOR_STABILITY`, `BOND_STRENGTH`, `OTHER`), result (`PASSED`, `FAILED`, `PENDING`), test date, tester name, report link

### CosmoCoat Financial Accounting
Same double-entry accounting structure as Adviser (chart of accounts, journal entries, ledger, HKFRS reports). Data is fully isolated from Adviser companies via separate `cos_` prefixed tables.

---

## Shared Infrastructure

### Authentication
- Email + password login; email verification; password reset via token
- Session-based auth (NextAuth / JWT)
- Separate login flows for admin staff and client users

### Document Storage
- Files stored in Cloudflare R2 (object storage)
- Upload via module-specific endpoints; download via signed URLs

### Audit Log
- Append-only `audit_logs` table records all CREATE / UPDATE / DELETE actions with actor, resource type, resource ID, before/after snapshots

### Cron Jobs
- Scheduled AML screening runs
- Monthly Due Diligence Report generation

### AI Features
- **"提交需求" widget**: floating button on every admin page; opens a multi-turn chat dialog; LLM clarifies and structures the requirement; user confirms; saved to `adv_feature_requests`
- **KYC document analysis**: batch AI-assisted review of uploaded KYC documents
- **NAR1 sync**: AI-assisted data extraction from Companies Registry annual return documents

### Internationalisation
- Supported locales: `en`, `zh-HK`
- All Adviser and client portal pages are localised via `next-intl`
- SFS Diamond and CosmoCoat public pages are not locale-prefixed
