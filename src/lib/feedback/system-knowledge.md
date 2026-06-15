# Adviser Platform — System Knowledge

## Overview

A multi-platform back-office system operated by a licensed TCSP (Trust and Company Services Provider) firm. Three independent platforms share one Next.js codebase and one PostgreSQL database:

| Platform | URL prefix | DB prefix | Purpose |
|---|---|---|---|
| **Adviser** | `/[locale]/` | `adv_` | TCSP back-office (main platform) |
| **SFS Diamond** | `/sfsdiamond/` | `sfs_` | Memorial diamond jewellery e-commerce |
| **CosmoCoat** | `/cosmocoat/` | `cos_` | Cosmetics manufacturing ERP |

Admin console is at `/[locale]/admin/`. Roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`, `CLIENT`. Staff access is further restricted by per-menu permission keys and per-platform flags.

Admin left navigation is grouped by module. Menu groups can be collapsed/expanded, and only one group stays expanded at a time; the current route's group opens automatically, including company-scoped financial sub-routes under Finance Management. The bottom utility area, including Requirements / Feedback and Logout, stays fixed within the browser viewport while admin content scrolls independently.

---

## Adviser Admin Console

### 1. Dashboard (`/admin`)
Key metrics at a glance are grouped into a distinct Adviser corporate-services module: active companies count, pending KYC submissions, open AML alerts, annual returns due within 30 days. Each metric links to the relevant module.

Includes a visually separate SFS Diamond order statistics module showing total SFS orders, active orders, orders created in the last 30 days, and distribution by SFS order status (`PENDING`, `QUOTED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`).

Includes a separate CosmoCoat operations module showing pending non-super-admin recipe change requests, sample orders in `DRAFT`, and sample orders in `IN_PROGRESS`; the pending-change metric links to the dedicated approval page, while the sample-order metrics link to filtered list views.

### 2. Companies (`/admin/companies`)
Manages the full portfolio of client companies.
- List with search (name / code / registration number), status badge, assigned client, annual return deadline (registration date + 42 days), financial-module toggle
- Company statuses: `ACTIVE`, `DORMANT`, `STRUCK_OFF`, `DEREGISTERED`
- Company types: `HONG_KONG`, `BVI`, `CAYMAN`, `MARSHALL`
- Auto-generates company codes by type: `AA#####` (HK), `BV#####` (BVI), `CA#####` (Cayman), `MS#####` (Marshall)
- Create new company; assign client user or pending-client email; assign staff
- Companies with the financial module enabled can optionally be assigned a **Financial Manager** from existing active back-office staff accounts; assignment can be left blank and filled later from the company edit form

**Company detail sub-pages** (`/admin/companies/[id]/...`):
- **Directors** — Register of Directors (ROD): add / edit / remove; date of appointment / cessation
- **Members** — Register of Members (ROM): shareholders with share class, share count, transfer history
- **Significant Controllers** — ROSC entries
- **Designated Representatives** — company representatives
- Generated ROD / ROM / ROSC documents automatically use linked KYC records as the source for natural persons' date of birth and place of birth
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
- In the queue list status column, records with missing required KYC files show a red missing marker for ID proof, address proof, and/or declaration when the latest file for that type is absent or rejected
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

- **Chart of Accounts** (`/accounts`): hierarchical accounts up to 4 levels; account types: `ASSET` (流动资产), `NON_CURRENT_ASSET` (长期资产), `LIABILITY` (流动负债), `NON_CURRENT_LIABILITY` (长期负债), `EQUITY`, `REVENUE`, `EXPENSE`, `CGS`, `CURRENT_ACCOUNT`; when a company has no accounts yet, opening the page auto-seeds 9 standard level-1 accounts: `01` 现金与银行, `02` 应收, `03` 应付, `04` 权益, `05` 收入, `06` 成本, `07` 行政费用, `08` 销售费用, `09` 财务费用; create / edit / delete; parent-account picker in the create/edit dialog shows each option as `code - name` with visual level indentation (not internal IDs); system accounts are locked; opening balance with debit/credit direction and account-level year-to-date cumulative debit and credit amounts can be created and edited on any leaf account (including level-1 accounts with no sub-accounts); accounts named `本年利润` / `本年利潤` automatically show year-to-date balance as credit amount minus debit amount in the form and account list; parent accounts with children do not accept separate opening balances or year-to-date cumulative amounts, and instead display read-only rolled-up totals from all descendant leaf accounts; when a leaf account becomes a parent, its own entered opening and cumulative amounts are cleared so the parent total comes only from children; accounts with opening balances can still be deleted when no journal entries reference them, and deletion clears their opening-balance records
- **Journal Entries** (`/journal`): create balanced vouchers with multi-line debits/credits; line detail columns show line description before account; account column opens a tree picker dialog showing level-1 / level-2 / level-3 account hierarchy, keeps manual fuzzy search by account code or name inside the dialog, labels selectable accounts as `code - name`, and allows level-2 and level-3 accounts plus the level-1 account itself when it has no children; the create/edit form uses taller line rows (科目、借方、贷方等字段) for easier data entry; in the entry form use **↑/↓** to move focus between line rows (**↓** on the last row adds a new line), **Enter** to confirm the current line and jump to the next (on the last line **Enter** saves the voucher), and **F1** to save the current voucher and clear the form for the next entry (date and company are kept — date defaults to the last successfully saved entry date, not today); after creating or editing a voucher, users can save and print the formal journal voucher, and can also print existing vouchers from the list or detail dialog; journal voucher print output is a concise A4 sheet with no browser page header/footer and no separate voucher title block — it starts with voucher metadata (voucher no, status, company, date, description, creator), followed by the line table and signature footer; the list detail dialog and print line table show **一级科目 / 二级科目 / 三级科目** columns with the full account hierarchy (`code name` per level, dash when that level is unused) so level-3 postings are visible in context; list supports checkbox multi-select and **batch post** for DRAFT entries (posted in entry-date order); statuses: `DRAFT` → `POSTED` / `CANCELLED`; cancelled vouchers can be reopened from the list or detail dialog, edited, and saved back to `DRAFT` for re-posting; support attachments; post to ledger; cancel/reverse entries; permanently delete already-cancelled entries to remove the voucher and its lines instead of keeping a cancelled record; grouped by period (YYYY-MM); Excel import for historical journal entries. Import accepts three formats: line-based rows by account code (`Voucher No`, `Date`, `Description`, `Account Code`, `Debit`, `Credit`); line-based rows by account name (`Date`, `Account`, `Particular`, `Debit`, `Credit`) — if any `Account` name in a grouped import record cannot be matched to a chart-of-accounts name, the whole record fails; paired rows (`Date`, `Description`, `Debit Account Code`, `Credit Account Code`, `Amount`). Imported entries are saved as Pending/DRAFT for review before posting.
- **General Ledger** (`/ledger`): account activity with running balances; entries are grouped by account code and sorted by date within each account; each account group's header row shows account code, account name, and account type (e.g. `ASSET 流动资产`, `LIABILITY 流动负债`) so accountants can quickly identify the category; each account group starts with a **期初余额** row (or the opening balance at the selected period/date range start), and running balances are recalculated from the account opening balance plus posted debit/credit movements rather than relying on stored ledger snapshots; balances are displayed as separate debit-balance and credit-balance columns, and fully offset debit/credit movements display as `0.00` rather than negative zero; filter by account type, period, custom start/end date range, voucher number, and a three-level cascading account selector (level 1 → level 2 → level 3) that displays placeholders, selected values, and account options as user-facing text (`code - name`, not internal IDs) and includes the selected account's descendant detail accounts; below the cascade selector, users can type an account code (e.g. `1001`, `1300`) and click **搜索科目** or press **Enter** to jump directly to that account and show its ledger activity (including descendant accounts when applicable); each posted voucher number has a small link button beside it that opens the corresponding journal entry detail dialog on the Journal Entries page
- **HKFRS Reports** (`/reports`): trial balance, income statement (P&L), balance sheet, cash flow statement generated from posted journal-entry lines (ledger rows are derived records); amounts on screen and in Excel/CSV export show as plain numbers with two decimal places (no currency code or symbol such as HKD / USD / RMB); trial balance period movement columns are labelled **本期借方** / **本期贷方**, and closing balances follow each account type's normal debit/credit direction (for example `LIABILITY` balances display as credit balances); trial balance shows detail accounts plus level-1 summary rows (marked「一级汇总」) for level-1 accounts that have sub-accounts, with rolled-up period debit/credit and closing balances grouped above their descendant detail rows; a **科目层级** selector lets users filter the trial balance to **仅一级科目**, **前两级科目**, or **全量明细** (debit/credit totals always reflect all level-1 accounts regardless of filter); level-1 summary rows and leaf level-1 detail rows are counted in the trial-balance debit/credit totals, while descendant level-2+ detail rows and computed rows are not counted; leaf level-1 accounts without sub-accounts still appear as regular detail rows; a computed `本年利润` / `本年利潤` row may still appear at the end when period profit is non-zero; rows are sorted by chart-of-accounts `sortOrder`; when chart-of-accounts entries are created, edited, or deleted, the reports page for the same company auto-refreshes without clicking the generate button (including when accounts and reports are open in separate browser tabs); balance sheet follows HKFRS presentation with non-current/current asset and liability groupings plus an equity section (assets: 非流动资产 → 流动资产; liabilities and equity: 所有者权益 → 非流动负债 → 流动负债); balance sheet **defaults to level-1 summary rows only** (amounts roll up into their level-1 parent); users can **expand** a level-1 row that has sub-accounts to reveal level-2+ detail lines inline; trial balance shows only account lines with period and closing debit/credit amounts, plus **借方合计** / **贷方合计** and a **已平衡** / **不平衡** badge (with warning when debit and credit totals differ); it does **not** show asset/liability/equity subtotals or accounting-equation validation on screen or in trial-balance CSV/Excel export; balance sheet automatically validates the accounting equation **Assets = Liabilities + Equity** (equity includes current-period profit) and shows asset/liability/equity subtotals with a clear difference amount and warning when unbalanced; supports exporting all four statements into one Excel workbook
- P&L displays income statement sections in this order: revenue, main business cost / cost of sales, gross profit, expense details, net profit. It uses only the selected accounting period's posted journal-line debit/credit movements keyed by `JournalEntry.period` (for example, a `2026-05` report uses only vouchers posted into accounting period `2026-05`), not cumulative account balances: revenue is credit minus debit, while CGS and expenses are debit minus credit. P&L detail rows show the source period movement columns **本期借方** and **本期贷方** alongside the statement amount. Revenue totals include direct postings to level-1 revenue accounts such as `主营业务收入`. For `REVENUE`, `CGS`, and `EXPENSE`, if a level-1 account has level-2 accounts, P&L line detail shows level-2 rolled-up amounts plus any direct level-1 postings; if a level-1 account has no level-2 accounts, it shows the level-1 amount. Any active P&L account with monthly movement that is not covered by those normal statement levels is still included so trial-balance period movements are not lost. Expense details are grouped into `销售费用`, `管理费用`, and `财务费用`, each with its own subtotal plus an overall expense total.
- **Consolidated Report Groups** (on selector page): named portfolios grouping multiple companies for consolidated reporting; create / delete groups; groups do not own journal entries (reporting only)
- **Parties / 往来单位** (`/parties`): unified customer / supplier / employee master data per company (one record can have multiple roles); code + name + contact info + payment terms (days) + editable color label; used by AR/AP modules; customer and supplier parties can link to an existing level-1/2/3 AR/AP chart account through a searchable high-contrast account picker with colored account-type labels, and creating or editing a party opens a wider dialog so the full profile form is easier to complete; creating a new customer/supplier without selecting one auto-creates a party-specific account named with `应收-AR` / `应付-AP`; deleting a party that already has documents deactivates it instead of deleting
- **Receivables / 应收管理** (`/receivables`): sales invoices (auto-numbered `INV-YYYYMM-####`) with line items, per-line revenue account override, tax rate; sales-invoice create/edit dialog includes quick tax-rate buttons for **3% / 6% / 9% / 13%** beside the tax-rate input; draft → 开票过账 (auto-creates a posted journal entry: debit AR control / credit revenue + output tax) → partial/full settlement; register receipts (`RCT-`) with allocation against open invoices (auto-allocate by due date supported), receipts auto-post (debit bank/cash, credit AR); customer credit notes (`CN-`) post to GL and can be applied against open invoices; void = automatic reversal entry (红冲), never deletion; AR aging report with buckets 未到期 / 1-30 / 31-60 / 61-90 / 90+ days; invoice statuses `DRAFT → ISSUED → PARTIALLY_PAID → PAID / VOIDED` with derived `OVERDUE` display; the current tab view (sales invoices, receipts, credit notes, or aging) can be exported to Excel using all rows in the current filtered result, not just the visible page; edit dialogs use unified high-contrast dark financial input styling for text/date/number/select/account fields, including visible focus states and readable native date/number controls
- **Payables / 应付管理** (`/payables`): mirror of receivables for suppliers — purchase bills (`BILL-`, with supplier invoice ref) post debit expense + input tax / credit AP control; bill payments (`PAY-`) with allocation; supplier debit notes (`DN-`); AP aging report; statuses `DRAFT → POSTED → PARTIALLY_PAID → PAID / VOIDED`; the current tab view (purchase bills, payments, debit notes, or aging) can be exported to Excel using all rows in the current filtered result, not just the visible page; edit dialogs use unified high-contrast dark financial input styling for text/date/number/select/account fields, including visible focus states and readable native date/number controls
- **Banking / 银行与现金** (`/banking`): bank accounts linked to a GL account through a searchable high-contrast account picker with colored account-type labels (shows live GL balance); CSV bank statement import (columns Date/Description/Reference/Amount or Credit+Debit; Chinese column names supported); bank reconciliation: create per-period reconciliation with statement balance, auto-match statement lines to ledger rows (exact amount + ±3-day window, reference match preferred), manual match/exclude, reconciliation summary (statement vs GL balance with outstanding-item explanation), completion requires zero unexplained difference
- **Account Mappings** (API `/api/admin/financial/account-mappings`): per-company posting-rule mapping (AR/AP control, default revenue/expense, output/input tax, default bank/cash); for newly initialized companies, unmapped rules fall back to the 9 standard level-1 account codes (`02`/`03`/`05`/`07`/`09`/`01`/`04`) when not configured
- **Fiscal periods**: periods (YYYY-MM) can be CLOSED/LOCKED per company; posting (manual or subledger-generated) into a closed period is blocked
- All subledger documents (invoices/bills/receipts/payments/credit notes) generate journal entries through a single posting engine with source tracking (`sourceType`/`sourceId`) and reversal chains; voiding a posted document always creates a reversal voucher

Financial module can be enabled/disabled per company via the `financialEnabled` flag. Non-`SUPER_ADMIN` users only see and operate financial companies where they are assigned as that company's Financial Manager; unassigned companies must be assigned before regular staff can perform bookkeeping/financial operations. The financial admin UI is localized in Chinese. The `/admin/financial` company selector shows each company's assigned Financial Manager name (from `company_staff_assignments`, with fallback to the company record) in the dropdown list and below the selected company trigger.

### 6. Invoices (`/admin/invoices`)
Service invoicing for TCSP professional fees.
- List with search, status filter
- Invoice statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Create invoices for either a linked client company or an approved personal KYC identity; billing fields are auto-filled from the selected customer and can be manually adjusted; line items support description, quantity, and unit price only (no tax-rate input on the form; tax defaults to 0%); the line-item editor uses a wider multi-line description field with quantity/unit-price controls grouped beside it
- Edit DRAFT invoices from the invoice detail page, including billing fields, dates, notes, and line items; status changes remain available there
- Generate and download PDF; the PDF uses global 6AM Advisory sender contact details in the header and Bank of China (Hong Kong) / FPS payment instructions in the footer
- Link invoices to client companies or approved individual KYC records

### 7. Team Management (`/admin/team`)
Staff access control.
- Roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`
- Per-staff platform access flags (Adviser / SFS Diamond / CosmoCoat)
- Granular admin-menu permission keys (companies, kyc, aml, financial, invoices, team, feedback, sfs-customers, sfs-orders, sfs-invoices, cosmocoat-* including cosmocoat-customers, cosmocoat-suppliers, cosmocoat-employees, cosmocoat-sample-orders)
- Legacy mode: no restrictions; new mode: explicit per-menu grants
- Create / edit / deactivate staff accounts
- Active `STAFF`, `COMPLIANCE`, and `SUPER_ADMIN` accounts can be selected as per-company Financial Managers from Company Management; this assignment controls financial-operation authority for enabled companies

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
- The "提交需求" floating button appears at the top-right of every admin page (below the header); it opens a chat dialog that clarifies the request and saves a structured summary
- Requirement chat attachments upload through the storage adapter to OSS in production and save stable OSS/CDN links plus storage keys in the feature request attachments JSON

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
- **Floating AI Chat Widget**: gold (#C9A96E) circular button fixed at bottom-right of all SFS Diamond pages; opens a 340×480 chat panel; answers visitor questions about company info, the CVD process, FAQ content, ordering, and memorial diamond details; powered by `claude-haiku-4-5-20251001` via `/api/sfsdiamond/chat`; knowledge is embedded statically in the server-side system prompt (no DB query); no authentication required
- **Home**: hero, process overview, team, four value pillars, Eternity Ring 3D visualization
- **About**: company background, mission, vision
- **Technology**: diamond creation process (CVD growth explained)
- **Memorial Diamonds**: product showcase
- **Q&A**: FAQ
- **Order** (`/order`): public order placement form; Diamond Specs options are database-driven from SFS Diamond Specs admin, including image-backed Color / Shape / Ring Design / Necklace Design / Earring Design / Bracelet Design options (color step shows admin-uploaded preview thumbnails); setting types include Ring, Necklace, Earring, Bracelet, and Diamond only; anonymous submissions create an order and SFS customer record, while logged-in SFS clients also get the order linked to their account
- **Order Success** (`/order/success`): confirmation page
- **Dashboard** (authenticated): client's orders with milestone progress; each order includes an editable **Your Internal Order Code** field for the customer's own reference numbering (updatable at any time on My Orders and order detail)
- **Dashboard Detail** (`/dashboard/[id]`): specific order status and phase timeline; internal order code field alongside order details
- Authenticated SFS Dashboard pages and the order edit flow include an English AI request chat widget for submitting feature requests or improvement ideas

### SFS Customers Admin (`/admin/sfs-customers`)
Customer registry for SFS Diamond.
- Lists SFS platform registered client accounts, manually created customer profiles, and historical order-only contact records
- Shows customer name, email, phone, mailing address, source type, order count, and latest order link/status
- Create manual SFS customer records without creating or binding an official platform login account/email
- Edit SFS customer profile fields (name, email, phone, mailing address, notes); order-only contacts are converted to bound customer profiles when edited
- Delete customer profiles that have no order history; customers linked to any order cannot be deleted; deletion requires a confirmation dialog
- Each bound customer profile includes a cooperation-contract attachments module on the edit dialog: upload, view, download, and delete partnership agreement files (PDF, Word, JPG, PNG, WEBP; max 10 MB)

### SFS Diamond Specs Admin (`/admin/sfs-diamond-specs`)
Customer-facing order option management for SFS Diamond.
- Page opens with the **Color** category filter selected by default; admins can switch to All or any other category tab
- Maintains active/inactive options for Color, Carat, Shape, Setting Type, Ring Design, Necklace Design, Earring Design, Bracelet Design, and Metal
- Color, Shape, Ring Design, Necklace Design, Earring Design, and Bracelet Design options can store preview image URLs; admin can upload images to OSS/local storage or paste an existing URL
- Active options are shown on `/sfsdiamond/order`; submitted orders keep saved text values

### SFS Orders Admin (`/admin/sfs-orders`)
Order lifecycle management for memorial diamond commissions.
- List with search (client name / email / order ID); columns: status, sample code, memorial name, client, source type, colour, diamond count, creation date
- Order detail shows the customer's self-entered internal order reference (read-only) when set
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
- Order steps: create / update / complete sub-tasks within Chemical Transformation, CVD Growth, Crafting, and Jewelry Setting phase panels; Chemical Transformation phase (12 steps) begins with **Package Received**, then **Package arrived production site**, Check Sample & Labeling, and the remaining NL00001 workflow steps
- Completed step attachments: uploaded images display at 224×224px (4× the previous thumbnail size) for easier admin review
- Production step images uploaded in Chemical Transformation, CVD Growth, Crafting, and Jewelry Setting require manual review (`PENDING` / `APPROVED` / `REJECTED`); staff uploads are auto-marked `PENDING` and await `SUPER_ADMIN` approval; only `APPROVED` images are visible to SFS clients and included in customer production reports; `PENDING` and `REJECTED` images are hidden from clients; approval creates a customer notification

### SFS Invoices Admin (`/admin/sfs-invoices`)
- Invoices linked to SFS orders
- Statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Auto-generated invoice numbers: 8-digit pure numeric format `YY######` (e.g. `26000001`, `26000002`), sequential within each calendar year; shown in the list table column and in the page header (top-right) on new and detail pages
- Create from order; edit DRAFT; generate and download PDF
- Admin invoice screens keep line-item display focused on description, quantity, weight, unit price, and amount; due date and tax-rate display are hidden from the SFS invoice UI
- PDF issuer header: **SFS Technical Group Co., Limited / 瑞福生科技集團有限公司**, with fixed address **RM7 20F BOSS COMMERCIAL CENTRE 28 FERRY STREET YAU MA TEI KOWLOON** below the company name
- PDF payment block (footer): DBS BANK (HONG KONG), SWIFT DHBKHKHH, Bank Code 016, Account Number 478002236556, A/C Name SFS TECHNOLOGY GROUP CO., LIMITED

---

## CosmoCoat Platform

Cosmetics manufacturing ERP. Public product site at `/cosmocoat/`; manufacturing management under Adviser admin console.

### Public Pages (`/cosmocoat/`)
Home, Products catalog, Product detail, About, Supporting.

- **Floating AI Chat Widget**: cyan (#00d4ff) square button fixed at bottom-right of all CosmoCoat pages; opens a 340×480 terminal-themed chat panel; answers questions about product formulas, process parameters, and material lists; powered by `claude-haiku-4-5-20251001` via `/api/cosmocoat/chat`; knowledge is fetched live from the `cos_table_recipes` DB table on each request (includes category, batch quantity, viscosity, shelf life, material items with quantities); no authentication required

### Factory Products (`/admin/cosmocoat-factory-products`)
Finished goods produced by the factory.
- Fields: product code, name, category, unit (kg), unit price, viscosity, current recipe, linked recipes, sort order
- Product list shows viscosity column (text value + optional unit S or KU)
- When a current recipe is assigned, product viscosity is read-only and automatically synced from that recipe's viscosity; updating recipe viscosity propagates to all linked factory products using it as current recipe
- Without a current recipe, viscosity can be entered manually (free-text range e.g. `9.7-9.8`, unit S or KU)
- Assign / change current recipe; link multiple recipe candidates
- Search / filter by name or category

### Product Categories (`/admin/cosmocoat-product-categories`)
Hierarchical category tree (up to 3 levels) for the website catalog.
- Create parent / child categories; upload category image; set slug and active status; reorder

### Raw Materials (`/admin/cosmocoat-raw-materials`)
Purchasing and sourcing registry.
- Fields: production code, CAS (stored as `huaxingCode`), attribute code, category, name; list and detail pages display the field as CAS
- Dual supplier support: primary and secondary (name, package size kg, price/kg, tax flag, freight flag, notes)
- Changing a raw material's primary price/kg (including via bulk import) automatically refreshes all referencing recipe and semifinished costs; no manual batch refresh is required
- Attach and download TDS (Technical Data Sheet) and MSDS (Material Safety Data Sheet) files
- Bulk import from file

### Recipes (`/admin/cosmocoat-recipes`)
Product formulation management.
- Fields: recipe code, name, category, batch quantity, unit cost, product viscosity (free-text range e.g. `9.7-9.8`, unit S or KU — in basic info above notes), optional shelf life in days
- Line items: raw materials, factory finished products (from factory products module), component recipes (nested semifinished), or Sol semifinished inventory, with quantity, unit price, percentage
- Material list on recipe detail: unified columns for all line types (raw material, semifinished, factory product); 单价 is the editable saved line cost for every row type
- Material picker on new/edit recipe page: tabs for 原材料, 半成品, and 成品; finished-product tab loads live `unitPrice` from factory products via a dedicated recipe picker API (always fresh from DB, refreshes when switching to the 成品 tab or when the page becomes visible again), with category filter and search, same click-to-select and "添加选中" flow as raw materials
- Unit cost is calculated by percentage: each line contributes `(quantity ÷ total quantity) × unit price`; accurate even when material quantities do not sum to 100
- Automatic cost calculation; line prices can be refreshed from latest source pricing, and raw-material primary price or factory-product unit price changes automatically cascade through dependent production recipes, nested semifinished recipes, and source-linked semifinished inventory unit prices
- Link to factory products; mark recipe as active/used
- Print recipe: downloads a simplified recipe detail DOCX containing only recipe code, name, category, batch quantity, unit cost, and material list with material code, name, source/category, quantity, and percentage
- Production process section: production speed requirements, production time requirements, packaging requirements, production notes (separate from QC)
- Packaging requirements: button quick-select presets (200目、300目、400目、色装机); clicking a preset fills the field; new recipes start with an empty packaging field (no default preset)
- QC section (separate card): multi-select checkboxes for standard tests (黏度, 百格, 水煮80C/30M, 湿油外观, 干板外观) plus optional free-text test standard; each checked test shows its own result input on the same row (unchecked tests hide result inputs); selected tests and custom text are carried into production order quality-check requirements when creating orders (viscosity checkbox includes recipe viscosity value when set)
- Material rows can be reordered by drag-and-drop; new order is auto-saved immediately
- **Change approval workflow**: non–`SUPER_ADMIN` roles cannot directly modify or delete existing recipes; PATCH/DELETE (including refresh-prices) create a pending change request (`UPDATE` or `DELETE`) for super-admin review; `SUPER_ADMIN` applies changes immediately; a dedicated page at `/admin/cosmocoat-recipe-approvals` lists pending / approved / rejected requests with requester info, review records, automatic core-change summaries, and before-vs-after difference rows (including material additions/removals/quantity or price changes, batch quantity changes, unit-cost changes, and basic/process/QC field changes); the recipe list page still shows a pending-only panel with a shortcut to the full approval page; non–super-admin users see **提交审批** on the detail page and get HTTP 202 when a request is queued; only one pending request per recipe at a time; creating new recipes does not require approval

### Color Matching Formulas (`/admin/cosmocoat-color-formulas`)
Custom color formulations for specific customers or products.
- Categories shown to users: PU, 色漆, 烤漆; stored enum identifiers remain `PU`, `BAKING_PAINT`, `HT_BAKING_PAINT` (legacy `LT_BAKING_PAINT` records may still exist)
- Scope: product-specific (linked to a factory product) or category-wide
- Fields: formula code, name, source recipe, linked CosmoCoat customer (search dropdown from Customer registry), optional technical responsible employee (TECHNICAL employees only), batch quantity, notes, and Pantone target color input with a 4× enlarged approximate preview swatch on the formula form (color code / target color remain hidden from list and print UI)
- Auto-generated formula codes use `{factoryProductCode}-{4-digit suffix}`; legacy formulas keep existing suffixes (e.g. `-0001`); newly created formulas start at `-5001` and increment within the 5001+ sequence per factory product
- Line items: raw material library entries, Sol semifinished inventory entries, or manual blank/custom material rows, with quantity, actual weight (实投), percentage, unit price
- List page: only the header "新建配方" button; empty state shows message only (no duplicate create button); supports filtering by linked CosmoCoat customer
- First line item is always the pinned "适用产品" row when a factory product is linked; it cannot be deleted but quantity is editable; unit price auto-fills from the linked factory product's `unitPrice` (read-only in the UI)
- Material details use the same split layout as recipe management: selected item table above, candidate material table below with click-to-select and "添加选中"; picker category filter is single-select (default none — user picks one of AD, SO, Sol semifinished, DY, CO, CA, CC); selecting Sol semifinished loads only Sol semifinished inventory records, not raw materials
- Category tabs filter the factory-product sub-filters below: PU tab shows only factory products whose product category name is exactly「PU漆」; 色漆 and 烤漆 tabs use inferred category matching
- Clicking "新建配方" while a product filter is active pre-fills that product in the new formula form
- Formula detail/new page includes a linked sample-order field: users can search and attach one or more CosmoCoat sample orders, set per-order sample quantity (kg) and notes, and open the linked sample order directly from the formula page
- Detail page has a "打印文件" action: opens a dialog to enter target production weight (kg), scales product and raw-material line quantities proportionally, then triggers browser PDF print (A4, no page header/footer). Print header shows 调色单号 (formula code), name, category, linked factory product, production weight, and notes. Material table shows 序号 / 生产编号 / 原料·产品名称 / 用量(kg) / 占比 / 实投(kg) / 备注 only (hides attribute, color code, target color, source recipe, customer, unit price, and amount columns); 实投 scales with the entered production weight from each line's saved actual-weight value. Production instructions from the linked source recipe are not included in print output.

### Employees (`/admin/cosmocoat-employees`)
CosmoCoat factory staff registry (内务、销售、生产、技术、编外人员).
- Employee types: `INTERNAL` (内务人员), `SALES` (销售人员), `PRODUCTION` (生产人员), `TECHNICAL` (技术人员), `OUTSOURCED` (编外人员); sales and technical staff can be assigned to CosmoCoat sample orders
- Fields: employee code (auto `YG####` if omitted), name, type, phone, email, position, department, ID card number (15- or 18-digit with checksum validation), birth date (auto-filled from ID card on create; manual birth-date edits take precedence over ID card thereafter), system-calculated five element (by day master / day stem from birth date) and zodiac (by lunar birth year), hire date, notes, active status
- List with search (code / name / phone / email / position / department) plus dropdown filters for employee type, five element (`金` / `木` / `水` / `火` / `土`), and status (active / inactive); results update immediately and the paginated table shows hire date, complete-year service years (工龄), five element column (五行, auto-calculated from birth date, immediately left of 更新时间), and update time
- Create, view, edit, and delete at `/admin/cosmocoat-employees/[id]`; new at `/admin/cosmocoat-employees/new`
- Upload, preview, download, and delete **劳动合同**, **简历**, and **身份证** files (PDF, Word, JPG, PNG, WEBP; max 10 MB); PDFs and images open in an in-page preview dialog, Word files use online preview when the storage URL is publicly accessible and otherwise keep a download fallback; new employee forms can select files before saving, and creation saves the employee record and selected files together (if file upload fails, the employee is not created)
- Production orders can assign an active **生产人员** via a dropdown on the detail page; assigned employee profile details are not shown on the production order detail page

### Production Orders (`/admin/cosmocoat-production-orders`)
Manufacturing batch tracking.
- Fields: order code, factory product, recipe, total weight, optional assigned production employee (dropdown only; no employee detail panel on the detail page; batch number is not shown or editable on the detail page, though list view still has a 批次 column)
- Detail page shows recipe code, name, and viscosity range (read-only, e.g. `9.7-9.8 S` or `9.7-9.8 KU` from the linked recipe); there is no link/button to open the linked recipe detail page
- New order page: factory product picker supports type-to-search with fuzzy matching (product code, name, current recipe); loads options on demand via lightweight API instead of bulk-fetching all products
- Product list auto-excludes factory products without a current recipe; optional `?recipeId=` URL param further limits choices to products linked to that recipe
- Recipes containing only nested sub-recipes or semifinished components (no raw-material lines) show an empty materials table instead of crashing
- Statuses: `DRAFT` → `IN_PROGRESS` → `COMPLETED`
- Line items: raw materials, semifinished component recipes, and Sol. semifinished inventory components with required weight and actual weight used; selecting a product on new order or opening a draft order loads the full linked recipe material list and preserves saved actual weights when rows are synced; draft orders have **从配方重新加载** on both the materials table and 生产工艺 sections to refresh material lines and process/QC fields from the current recipe
- Detail page **生产工艺** section: selecting a product on new order (or opening an existing order) auto-loads the linked recipe's production speed, production time, packaging requirements, and production notes; fields are editable on the order, with a **从配方重新加载** action on draft orders to reset from the current recipe
- Detail page **QC** section: auto-loads recipe QC test checkboxes (黏度, 百格, 水煮80C/30M, 湿油外观, 干板外观 — viscosity checkbox shows recipe viscosity when set), optional custom test standard, and per-item result inputs (only for checked tests); all editable on the order
- Print production order: A4 sheet with enlarged text, no page header/footer, darker high-contrast print colors, a material table constrained to page margins, and material names omitted while keeping material codes, ratios, required weight, and actual weight
- Print output includes structured 生产工艺 and QC sections from the order's saved process/QC fields; QC print layout lists each selected test item on its own row (测试项目 / 测试结果) with a bordered result box per item (pre-filled when saved, blank for handwriting on paper); optional custom test standard appears as an additional row
- Production-order list rows have a product-label print action next to edit; it prints a 100mm x 70mm label with product name (editable before printing), production order number, recipe code, recipe shelf life, and weight (editable before printing)
- Output: creates semifinished product inventory entries on completion

### Semifinished Products (`/admin/cosmocoat-product-semifinished`)
Intermediate inventory from production.
- Fields: code, name, category (Sol.), stock quantity (kg), unit price, source production order
- Used as components in recipes

### Process Kits (`/admin/cosmocoat-process-kits`)
Product application method documentation (產品配套工藝書).
- List page with search (code / name / description), status filter (`DRAFT` / `ACTIVE` / `ARCHIVED`), date-field dropdown (`updatedAt` / `createdAt`), date-range dropdown (last 7 / 30 / 90 days or custom start/end date), and paginated table; create, edit, and delete from the list
- Fields: kit code, name, status, materials list, performance standards, usage notes
- Performance standards are multi-select checkboxes: 百格(5B), water-boiling tests (80C30M/60M, 100C30M/60M/120M), RCA (30/50/100/150/200), hardness (B/HB/H/2H), chemical resistance (耐醇 99%/50, 耐醇 99%/100, 耐醇 99%/200, 耐 MEK/50, 耐 MEK/100), high temp/humidity & salt spray (高温高湿/盐雾, 65°C/85%RH 24H, 65°C/85%RH 48H, 5% NaCl盐雾24H, 5% NaCl盐雾48H)
- Kit statuses: `DRAFT` → `ACTIVE` → `ARCHIVED`
- Process flow module is available on the new/detail process-kit page below performance tests; admins can add multiple reference factory products and optionally set each product's IR minutes (min), IR temperature (°C), UV energy (MJ/CM²), film thickness (μm), spray viscosity (`噴塗粘度 2#杯/25C`, 2# flow cup at 25C, unit S), and notes — all process-parameter fields are optional and a product row can be saved without filling them; field labels, table/preview values, and print/Word export append the standard unit when the saved value does not already include it
- When adding a reference product in the process-flow module, the main product picker supports manual type-to-search with fuzzy matching on factory product code and name so large product catalogs can be searched without scrolling a long dropdown
- After adding products to the process flow list, each row has Edit and Delete actions; Edit allows updating HD Hardener and Diluent thinner selections plus their ratios, IR minutes, IR temperature, UV energy, film thickness, spray viscosity, and notes for that product (works on both new and saved process kits); process parameters remain optional on edit as well
- Process-kit product rows are linked to Factory Products by ID; when a linked factory product is updated (code, name, viscosity, etc.), all referencing process kits automatically refresh their linked product display names in the database, touch the process-kit `updatedAt`, and hot-refresh any open process-kit detail page and linked product options without manual reload or sync (same tab and other tabs immediately; other active admin sessions auto-refresh via linked-product polling)
- Each selected product can optionally include an HD Hardener product with ratio to the main product, and a Diluent thinner product with ratio to the main product
- A4 print and Word export for process-kit detail pages include the CosmoCoat logo in the top-left page header and fixed CosmoCoat sales-company, production-factory, address, phone, and website contact information in the top-right page header
- The process-kit page builds a complete process-flow document from an ordered list of products and standalone process steps plus the global process-flow note; use **添加工艺** in the process-flow section header to add numbered process steps even when no reference product is selected
- Products and standalone process steps share one continuous sequence (1, 2, 3…); hover any item in the document preview and use **在该产品下方添加工艺** to insert a new process at the next position (automatic renumbering); each process step can be edited or deleted
- Legacy product-nested process blocks are migrated into the unified ordered list on read when stored `processFlowItems` is empty
- Detail page actions include browser-based A4 printing and browser-generated Word document download for the current process-kit content; no backend export job is used
- Print and Word export use darker high-contrast colors and include only core process information: basic info, performance standards (grouped by test category — 百格, 水煮测试, RCA, 硬度, 耐化学性, 高温高湿/盐雾 — listing selected test item names only, no test results), and the process-flow document (numbered products and process steps only); the **全局备注** / global process-flow note field remains editable and visible on the detail page and in the on-screen document preview but is omitted from A4 print and Word export to avoid duplication; the standalone **产品组合** / product-parameters table, **产品材料清单**, and **测试记录** are omitted because product details are already shown inside the process flow
- In the Process Flow section of print and Word export, the table uses a fixed narrow label column and wide content column so long process notes and full process documents stay readable in both browser print preview and downloaded Word files
- Every process-kit detail page includes a standardized operation notes section at the bottom covering pretreatment, filtering, recommended spray environment, coating storage conditions, disclaimer, and first-article testing requirements; these standardized notes are omitted from A4 print and Word export so exported documents contain only the core process-kit content
- Test records (detail page only, not in print/Word): type (`PERFORMANCE`, `DURABILITY`, `ADHESION`, `COLOR_STABILITY`, `BOND_STRENGTH`, `OTHER`), result (`PASSED`, `FAILED`, `PENDING`), test date, tester selected from active CosmoCoat Employee Management `TECHNICAL` employees, optional notes, and one internal-only JPG/PNG/WEBP report image stored as the report link
- **Change approval workflow**: non-`SUPER_ADMIN` roles cannot directly modify or delete existing process kits; updating or deleting a saved kit creates one pending change request (`UPDATE` or `DELETE`) per kit for super-admin review, while creating a new process kit still takes effect immediately; the process-kit list page shows a **待审批变更** panel for super admins with approve/reject actions, change summaries, and before-vs-after diff rows; non-super-admin users see **提交审批** on the detail page, and product-combination / process-flow / test-record edits stay local in the page until submitted for approval

### Customers (`/admin/cosmocoat-customers`)
Unified customer registry for CosmoCoat manufacturing clients (raw material purchases, recipe services, finished goods).
- Fields: customer code (auto-generated `KH####` if omitted), name, optional linked CosmoCoat platform login account (from Customer Account Management), phone, address, production equipment parameters (free-text multi-line field below address on create/edit form)
- List with search (code / name / phone / address / linked account email); paginated table; list rows can be exported to Excel using all rows that match the current search filter, including customer code, name, linked account email/name, phone, address, and updated date
- Bulk import from Excel/CSV on the list page: upload a table containing customer names only; the system creates customer records and auto-generates `KH####` codes
- Create, view, edit, and delete customer profiles; detail page at `/admin/cosmocoat-customers/[id]`; new at `/admin/cosmocoat-customers/new`; **Save changes** / **Create customer** and **Cancel** actions are in the page header for quick access (no bottom save bar)
- Upload, view, download, and delete **营业执照** files on saved customer profiles (PDF, JPG, PNG, WEBP; max 10 MB); new customers must be saved before uploading
- Each CosmoCoat platform account can be linked to at most one customer profile

### Suppliers (`/admin/cosmocoat-suppliers`)
Independent supplier registry for CosmoCoat sourcing; data and permission key are separate from customer management.
- Fields: supplier code (auto-generated `SC####` if omitted), name, contact information, address
- List with search (code / name / contact information / address); paginated table
- Create, view, edit, and delete supplier profiles; detail page at `/admin/cosmocoat-suppliers/[id]`; new at `/admin/cosmocoat-suppliers/new`
- Upload, view, download, and delete supplier files on saved supplier profiles (PDF, Word, JPG, PNG, WEBP; max 10 MB); new suppliers must be saved before uploading

### Sample Orders (`/admin/cosmocoat-sample-orders`)
打样单（样品单）管理，用于客户打样需求的全流程跟踪。
- List with search (order code / customer / sales employee / technical responsible employee) and status filter; columns: 特急标识（勾选特急时显示红色“特急”）, customer, sales employee, responsible employee, status, creation date
- Statuses: `DRAFT` → `IN_PROGRESS` → `COMPLETED`
- Create at `/admin/cosmocoat-sample-orders/new`; detail at `/admin/cosmocoat-sample-orders/[id]`
- Link to a CosmoCoat customer profile (required), optional sales employee (`SALES` type), and optional responsible employee (`TECHNICAL` type)
- **One process kit per order** (database unique constraint on `sampleOrderId`); line items also support multiple Color Formulas, each with quantity in kg; no duplicate formulas on the same order
- Process kit lines do not require a sample weight: the process-kit picker is a searchable dropdown that matches by code or name and shows code, name, and **适用材料** (substrate types) before selection; adding a kit loads the full process-flow document on expand (performance standards shown with the same Chinese labels as Process Kits, product parameters, complete process flow); **适用材料** (substrate types with readable labels) and **适用产品** (reference factory product names) are always shown on the kit card header without expanding; kit **materials** checkbox selections and `otherNote` for「其他」are included in the applicable-materials summary; only color formulas use quantity (kg)
- Basic info: customer (required), sales employee dropdown from CosmoCoat Employee Management `SALES` employees, responsible employee dropdown from `TECHNICAL` employees, a **特急** checkbox flag, optional **reference sample image** (max 1, upload to OSS), then order-level fields for **素材选择** (single value from Process Kit substrate presets or custom text), **打样种类** (`调色种类` / `UV种类` / `性能测试`), **样板要求**, **样油要求**, **特别工艺(常规不能满足)**, and **notes**; list shows 4× enlarged thumbnail; detail page shows enlarged image (up to 480px height) in all statuses
- Auto-generated order codes: `YP####` (e.g. `YP0001`)
- Progress tracking: step indicator (草稿 → 进行中 → 已完成), `startedAt` when moving to IN_PROGRESS, `completedAt` when marked COMPLETED
- Actions: Save (DRAFT), 开始打样 (→ IN_PROGRESS), 标记完成 (→ COMPLETED); completed orders lock line items, customer, and employee assignments but remain viewable
- Detail page shows linked color-formula information in both the editable/read-only 调色配方明细 table and the expanded scaled material tables below; formulas linked from the color-formula module appear here automatically
- **Print** on detail page (`/admin/cosmocoat-sample-orders/[id]`): browser print (A4) exports full order — customer profile, **特急** checkbox marker (red 特急 text when enabled), sales and responsible employees, reference sample image, sample kind, substrate/sample-panel/sample-oil/special-process requirements, notes, process-kit details (applicable materials/products, performance standards, product parameters, process flow), color-formula line items, and scaled material tables; signature row for 打样人员 / 质检确认 / 客户签收
- Delete allowed for DRAFT and COMPLETED orders; IN_PROGRESS orders cannot be deleted

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
- Append-only `audit_logs` table records standard CREATE / UPDATE / DELETE actions with actor, resource type, resource ID, before/after snapshots; journal-entry permanent delete is an explicit cleanup action for already-cancelled vouchers and does not retain the deleted voucher snapshot.

### Cron Jobs
- Scheduled AML screening runs
- Monthly Due Diligence Report generation

### AI Features
- **"提交需求" widget**: floating button at the top-right of every admin page (below the header); opens a multi-turn chat dialog; LLM clarifies and structures the requirement; user confirms; saved to `adv_feature_requests`
- **KYC document analysis**: batch AI-assisted review of uploaded KYC documents
- **NAR1 sync**: AI-assisted data extraction from Companies Registry annual return documents
- **SFS Diamond public chat** (`/api/sfsdiamond/chat`): NDJSON streaming endpoint; static knowledge base embedded in system prompt; no auth
- **CosmoCoat public chat** (`/api/cosmocoat/chat`): NDJSON streaming endpoint; live recipe knowledge fetched from DB per request; no auth

### Internationalisation
- Supported locales: `en`, `zh-HK`
- All Adviser and client portal pages are localised via `next-intl`
- SFS Diamond and CosmoCoat public pages are not locale-prefixed
