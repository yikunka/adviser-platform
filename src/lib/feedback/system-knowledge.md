# Adviser Platform — System Knowledge

## Overview

A multi-platform back-office system operated by a licensed TCSP (Trust and Company Services Provider) firm. Three independent platforms share one Next.js codebase and one PostgreSQL database:

| Platform | URL prefix | DB prefix | Purpose |
|---|---|---|---|
| **Adviser** | `/[locale]/` | `adv_` | TCSP back-office (main platform) |
| **SFS Diamond** | `/sfsdiamond/` | `sfs_` | Memorial diamond jewellery e-commerce |
| **CosmoCoat** | `/cosmocoat/` | `cos_` | Cosmetics manufacturing ERP |

Admin console is at `/[locale]/admin/`. Roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`, `CLIENT`. Staff access is further restricted by per-menu permission keys and per-platform flags.

Admin left navigation is grouped by module. Menu groups can be collapsed/expanded, and only one group stays expanded at a time; the current route's group opens automatically.

---

## Adviser Admin Console

### 1. Dashboard (`/admin`)
Key metrics at a glance are grouped into a distinct Adviser corporate-services module: active companies count, pending KYC submissions, open AML alerts, annual returns due within 30 days. Each metric links to the relevant module.

Includes a visually separate SFS Diamond order statistics module showing total SFS orders, active orders, orders created in the last 30 days, and distribution by SFS order status (`PENDING`, `QUOTED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`).

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

- **Chart of Accounts** (`/accounts`): hierarchical accounts up to 4 levels; account types: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`, `CGS`, `CURRENT_ACCOUNT`; create / edit / delete; system accounts are locked; opening balance with debit/credit direction and account-level year-to-date cumulative debit and credit amounts can be created and edited on level-2+ leaf accounts only; accounts named `本年利润` / `本年利潤` automatically show year-to-date balance as credit amount minus debit amount in the form and account list; level-1 accounts and any parent accounts with children do not accept separate opening balances or year-to-date cumulative amounts, and instead display read-only rolled-up totals from all descendant leaf accounts; when a leaf account becomes a parent, its own entered opening and cumulative amounts are cleared so the parent total comes only from children; accounts with opening balances can still be deleted when no journal entries reference them, and deletion clears their opening-balance records
- **Journal Entries** (`/journal`): create balanced vouchers with multi-line debits/credits; line detail columns show line description before account; account column supports type-to-search autocomplete with fuzzy matching on account code or name; in the entry form press **F1** to save the current voucher and clear the form for the next entry (date and company are kept — date defaults to the last successfully saved entry date, not today); list supports checkbox multi-select and **batch post** for DRAFT entries (posted in entry-date order); statuses: `DRAFT` → `POSTED` / `CANCELLED`; support attachments; post to ledger; cancel/reverse entries; permanently delete already-cancelled entries to remove the voucher and its lines instead of keeping a cancelled record; grouped by period (YYYY-MM); Excel import for historical journal entries. Import accepts three formats: line-based rows by account code (`Voucher No`, `Date`, `Description`, `Account Code`, `Debit`, `Credit`); line-based rows by account name (`Date`, `Account`, `Particular`, `Debit`, `Credit`) — if any `Account` name in a grouped import record cannot be matched to a chart-of-accounts name, the whole record fails; paired rows (`Date`, `Description`, `Debit Account Code`, `Credit Account Code`, `Amount`). Imported entries are saved as Pending/DRAFT for review before posting.
- **General Ledger** (`/ledger`): account activity with running balances; entries are grouped by account code and sorted by date within each account; filter by account, account type, period, date range
- **HKFRS Reports** (`/reports`): trial balance, income statement (P&L), balance sheet, cash flow statement; amounts on screen and in Excel/CSV export show as plain numbers with two decimal places (no currency code or symbol such as HKD / USD / RMB); trial balance closing balances follow each account type's normal debit/credit direction (for example `LIABILITY` balances display as credit balances); trial balance and balance sheet automatically validate the accounting equation **Assets = Liabilities + Equity** (equity includes current-period profit) and show a clear difference amount with warning when unbalanced; supports exporting all four statements into one Excel workbook
- **Consolidated Report Groups** (on selector page): named portfolios grouping multiple companies for consolidated reporting; create / delete groups; groups do not own journal entries (reporting only)

Financial module can be enabled/disabled per company via the `financialEnabled` flag. The financial admin UI is localized in Chinese.

### 6. Invoices (`/admin/invoices`)
Service invoicing for TCSP professional fees.
- List with search, status filter
- Invoice statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Create invoices for either a linked client company or an approved personal KYC identity; billing fields are auto-filled from the selected customer and can be manually adjusted; multiple line items support description, quantity, unit price; tax rate is not editable on the create form (defaults to 0%)
- Edit DRAFT invoices; status changes
- Generate and download PDF; the PDF uses global 6AM Advisory sender contact details in the header and Bank of China (Hong Kong) / FPS payment instructions in the footer
- Link invoices to client companies or approved individual KYC records

### 7. Team Management (`/admin/team`)
Staff access control.
- Roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`
- Per-staff platform access flags (Adviser / SFS Diamond / CosmoCoat)
- Granular admin-menu permission keys (companies, kyc, aml, financial, invoices, team, feedback, sfs-customers, sfs-orders, sfs-invoices, cosmocoat-* including cosmocoat-customers, cosmocoat-sample-orders)
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
- **Home**: hero, process overview, team, four value pillars, Eternity Ring 3D visualization
- **About**: company background, mission, vision
- **Technology**: diamond creation process (CVD growth explained)
- **Memorial Diamonds**: product showcase
- **Q&A**: FAQ
- **Order** (`/order`): public order placement form; Diamond Specs options are database-driven from SFS Diamond Specs admin, including image-backed Shape / Ring Design / Necklace Design options; anonymous submissions create an order and SFS customer record, while logged-in SFS clients also get the order linked to their account
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
- Each bound customer profile includes a cooperation-contract attachments module on the edit dialog: upload, view, download, and delete partnership agreement files (PDF, Word, JPG, PNG, WEBP; max 10 MB)

### SFS Diamond Specs Admin (`/admin/sfs-diamond-specs`)
Customer-facing order option management for SFS Diamond.
- Maintains active/inactive options for Color, Carat, Shape, Setting Type, Ring Design, Necklace Design, and Metal
- Shape, Ring Design, and Necklace Design options can store preview image URLs; admin can upload images to OSS/local storage or paste an existing URL
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
- Order steps: create / update / complete sub-tasks within phases; Chemical Transformation phase (12 steps) begins with **Package Received**, then **Package arrived production site**, Check Sample & Labeling, and the remaining NL00001 workflow steps
- Completed step attachments: uploaded images display at 224×224px (4× the previous thumbnail size) for easier admin review

### SFS Invoices Admin (`/admin/sfs-invoices`)
- Invoices linked to SFS orders
- Statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Auto-generated invoice numbers: 8-digit pure numeric format `YY######` (e.g. `26000001`, `26000002`), sequential within each calendar year; shown in the list table column and in the page header (top-right) on new and detail pages
- Create from order; edit DRAFT; generate and download PDF
- Admin invoice screens keep line-item display focused on description, quantity, unit price, and amount; due date and tax-rate display are hidden from the SFS invoice UI
- PDF issuer header: **SFS Technical Group Co., Limited / 瑞福生科技集團有限公司**, with fixed address **RM7 20F BOSS COMMERCIAL CENTRE 28 FERRY STREET YAU MA TEI KOWLOON** below the company name
- PDF payment block (footer): DBS BANK (HONG KONG), SWIFT DHBKHKHH, Bank Code 016, Account Number 478002236556, A/C Name SFS TECHNOLOGY GROUP CO., LIMITED

---

## CosmoCoat Platform

Cosmetics manufacturing ERP. Public product site at `/cosmocoat/`; manufacturing management under Adviser admin console.

### Public Pages (`/cosmocoat/`)
Home, Products catalog, Product detail, About, Supporting.

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
- Fields: recipe code, name, category, batch quantity, unit cost, product viscosity (free-text range e.g. `9.7-9.8`, unit S or KU — in basic info above notes)
- Line items: raw materials, factory finished products (from factory products module), component recipes (nested semifinished), or Sol semifinished inventory, with quantity, unit price, percentage
- Material picker on new/edit recipe page: tabs for 原材料, 半成品, and 成品; finished-product tab loads live `unitPrice` from factory products via a dedicated recipe picker API (always fresh from DB, refreshes when switching to the 成品 tab or when the page becomes visible again), with category filter and search, same click-to-select and "添加选中" flow as raw materials
- Unit cost is calculated by percentage: each line contributes `(quantity ÷ total quantity) × unit price`; accurate even when material quantities do not sum to 100
- Automatic cost calculation; line prices can be refreshed from latest source pricing, and raw-material primary price or factory-product unit price changes automatically cascade through dependent production recipes, nested semifinished recipes, and source-linked semifinished inventory unit prices
- Link to factory products; mark recipe as active/used
- Print recipe: downloads a simplified recipe detail DOCX containing only recipe code, name, category, batch quantity, unit cost, and material list with material code, name, source/category, quantity, and percentage
- Production process section: production speed requirements, production time requirements, packaging requirements, production notes (separate from QC)
- Packaging requirements: button quick-select presets (200目、300目、400目、色装机); clicking a preset fills the field; new recipes start with an empty packaging field (no default preset)
- QC section (separate card): multi-select checkboxes for standard tests (黏度, 百格, 水煮80C/30M, 湿油外观, 干板外观) plus optional free-text test standard; each checked test shows its own result input on the same row (unchecked tests hide result inputs); selected tests and custom text are carried into production order quality-check requirements when creating orders (viscosity checkbox includes recipe viscosity value when set)
- Material rows can be reordered by drag-and-drop; new order is auto-saved immediately

### Color Matching Formulas (`/admin/cosmocoat-color-formulas`)
Custom color formulations for specific customers or products.
- Categories shown to users: PU, 色漆, 烤漆; stored enum identifiers remain `PU`, `BAKING_PAINT`, `HT_BAKING_PAINT` (legacy `LT_BAKING_PAINT` records may still exist)
- Scope: product-specific (linked to a factory product) or category-wide
- Fields: formula code, name, source recipe, customer name, batch quantity (color code / target color / PANTONE preview are stored in DB but hidden from list, detail, and print UI)
- Line items: raw material library entries, Sol semifinished inventory entries, or manual blank/custom material rows, with quantity, actual weight (实投), percentage, unit price
- List page: only the header "新建配方" button; empty state shows message only (no duplicate create button)
- First line item is always the pinned "适用产品" row when a factory product is linked; it cannot be deleted but quantity is editable; unit price auto-fills from the linked factory product's `unitPrice` (read-only in the UI)
- Material details use the same split layout as recipe management: selected item table above, candidate material table below with click-to-select and "添加选中"; picker category filter is single-select (default none — user picks one of AD, SO, Sol semifinished, DY, CO, CA, CC)
- Category tabs filter the factory-product sub-filters below: PU tab shows only factory products whose product category name is exactly「PU漆」; 色漆 and 烤漆 tabs use inferred category matching
- Clicking "新建配方" while a product filter is active pre-fills that product in the new formula form
- Detail page has a "打印文件" action: opens a dialog to enter target production weight (kg), scales product and raw-material line quantities proportionally, then triggers browser PDF print (A4, no page header/footer). Print header shows 调色单号 (formula code), name, category, linked factory product, production weight, and notes. Material table shows 序号 / 生产编号 / 原料·产品名称 / 用量(kg) / 占比 / 实投(kg) / 备注 only (hides attribute, color code, target color, source recipe, customer, unit price, and amount columns); 实投 scales with the entered production weight from each line's saved actual-weight value. Production instructions from the linked source recipe are not included in print output.

### Production Orders (`/admin/cosmocoat-production-orders`)
Manufacturing batch tracking.
- Fields: order code, factory product, recipe, total weight
- New order page: factory product picker supports type-to-search with fuzzy matching (product code, name, current recipe); loads options on demand via lightweight API instead of bulk-fetching all products
- Product list auto-excludes factory products without a current recipe; optional `?recipeId=` URL param further limits choices to products linked to that recipe
- Recipes containing only nested sub-recipes or semifinished components (no raw-material lines) show an empty materials table instead of crashing
- Statuses: `DRAFT` → `IN_PROGRESS` → `COMPLETED`
- Line items: raw materials, semifinished component recipes, and Sol. semifinished inventory components with required weight and actual weight used; selecting a product on new order or opening a draft order loads the full linked recipe material list and preserves saved actual weights when rows are synced; draft orders have **从配方重新加载** on both the materials table and 生产工艺 sections to refresh material lines and process/QC fields from the current recipe
- Detail page **生产工艺** section: selecting a product on new order (or opening an existing order) auto-loads the linked recipe's production speed, production time, packaging requirements, and production notes; fields are editable on the order, with a **从配方重新加载** action on draft orders to reset from the current recipe
- Detail page **QC** section: auto-loads recipe QC test checkboxes (黏度, 百格, 水煮80C/30M, 湿油外观, 干板外观 — viscosity checkbox shows recipe viscosity when set), optional custom test standard, and per-item result inputs (only for checked tests); all editable on the order
- Print production order: A4 sheet with enlarged text, no page header/footer, a material table constrained to page margins, and material names omitted while keeping material codes, ratios, required weight, and actual weight
- Print output includes structured 生产工艺 and QC sections from the order's saved process/QC fields
- Output: creates semifinished product inventory entries on completion

### Semifinished Products (`/admin/cosmocoat-product-semifinished`)
Intermediate inventory from production.
- Fields: code, name, category (Sol.), stock quantity (kg), unit price, source production order
- Used as components in recipes

### Process Kits (`/admin/cosmocoat-process-kits`)
Product application method documentation (產品配套工藝書).
- Fields: kit code, name, status, materials list, performance standards, usage notes
- Performance standards are multi-select checkboxes: 百格(5B), water-boiling tests (80C30M/60M, 100C30M/60M/120M), RCA (30/50/100/150/200), hardness (B/HB/H/2H), chemical resistance (耐醇 99%/50, 耐醇 99%/100, 耐醇 99%/200, 耐 MEK/50, 耐 MEK/100), high temp/humidity & salt spray (高温高湿/盐雾, 65°C/85%RH 24H, 65°C/85%RH 48H, 5% NaCl盐雾24H, 5% NaCl盐雾48H)
- Kit statuses: `DRAFT` → `ACTIVE` → `ARCHIVED`
- Process flow module is available on the new/detail process-kit page below performance tests; admins can add multiple reference factory products and optionally set each product's IR minutes, IR temperature, UV energy (MJ/CM²), film thickness, spray viscosity (`噴塗粘度 2#杯/25C`, 2# flow cup at 25C), and notes — all process-parameter fields are optional and a product row can be saved without filling them; IR/UV/process values are text inputs so ranges and units such as `80-100`, `90-105°C`, or `12-14S` can be recorded when provided
- After adding products to the process flow list, each row has Edit and Delete actions; Edit allows updating IR minutes, IR temperature, UV energy, film thickness, and notes for that product (works on both new and saved process kits); process parameters remain optional on edit as well
- Each selected product can optionally include an HD Hardener product with ratio to the main product, and a Diluent thinner product with ratio to the main product
- The process-kit page builds a complete process-flow document from an ordered list of products and standalone process steps plus the global process-flow note; use **添加工艺** in the process-flow section header to add numbered process steps even when no reference product is selected
- Products and standalone process steps share one continuous sequence (1, 2, 3…); hover any item in the document preview and use **在该产品下方添加工艺** to insert a new process at the next position (automatic renumbering); each process step can be edited or deleted
- Legacy product-nested process blocks are migrated into the unified ordered list on read when stored `processFlowItems` is empty
- Detail page actions include browser-based A4 printing and browser-generated Word document download for the current process-kit content; no backend export job is used
- Test records: type (`PERFORMANCE`, `DURABILITY`, `ADHESION`, `COLOR_STABILITY`, `BOND_STRENGTH`, `OTHER`), result (`PASSED`, `FAILED`, `PENDING`), test date, tester name, report link

### Customers (`/admin/cosmocoat-customers`)
Unified customer registry for CosmoCoat manufacturing clients (raw material purchases, recipe services, finished goods).
- Fields: customer code (auto-generated `KH####` if omitted), name, optional linked CosmoCoat platform login account (from Customer Account Management), phone, address, production equipment parameters (free-text multi-line field below address on create/edit form)
- List with search (code / name / phone / address / linked account email); paginated table
- Create, view, edit, and delete customer profiles; detail page at `/admin/cosmocoat-customers/[id]`; new at `/admin/cosmocoat-customers/new`
- Each CosmoCoat platform account can be linked to at most one customer profile

### Sample Orders (`/admin/cosmocoat-sample-orders`)
打样单（样品单）管理，用于客户打样需求的全流程跟踪。
- List with search (order code / customer) and status filter; columns: reference sample thumbnail (4× size for DRAFT and IN_PROGRESS, standard size for COMPLETED), customer, process kit (0 or 1), color-formula count, total color-formula weight (kg), status, creation date
- Statuses: `DRAFT` → `IN_PROGRESS` → `COMPLETED`
- Create at `/admin/cosmocoat-sample-orders/new`; detail at `/admin/cosmocoat-sample-orders/[id]`
- Link to a CosmoCoat customer profile (required)
- **One process kit per order** (database unique constraint on `sampleOrderId`); line items also support multiple Color Formulas, each with quantity in kg; no duplicate formulas on the same order
- Process kit lines do not require a sample weight: adding a kit auto-expands the full process-flow document (performance standards, product parameters, complete process flow); kit **materials** are shown on the kit title; only color formulas use quantity (kg)
- Basic info: customer (required), optional **reference sample image** (max 1, upload to OSS), then **notes** below the image; list shows thumbnail; detail page shows full image
- Auto-generated order codes: `YP####` (e.g. `YP0001`)
- Progress tracking: step indicator (草稿 → 进行中 → 已完成), `startedAt` when moving to IN_PROGRESS, `completedAt` when marked COMPLETED
- Actions: Save (DRAFT), 开始打样 (→ IN_PROGRESS), 标记完成 (→ COMPLETED); completed orders lock line items and customer but remain viewable
- Detail page shows scaled color-formula material tables; process-kit content is shown inline in the 工艺书明细 section when creating or editing
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
- **"提交需求" widget**: floating button on every admin page; opens a multi-turn chat dialog; LLM clarifies and structures the requirement; user confirms; saved to `adv_feature_requests`
- **KYC document analysis**: batch AI-assisted review of uploaded KYC documents
- **NAR1 sync**: AI-assisted data extraction from Companies Registry annual return documents

### Internationalisation
- Supported locales: `en`, `zh-HK`
- All Adviser and client portal pages are localised via `next-intl`
- SFS Diamond and CosmoCoat public pages are not locale-prefixed
