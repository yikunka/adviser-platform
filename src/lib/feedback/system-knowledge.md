# Adviser Platform — System Knowledge

## Overview

A multi-platform back-office system operated by a licensed TCSP (Trust and Company Services Provider) firm. Two independent platforms share one Next.js codebase and one PostgreSQL database:

| Platform | URL prefix | DB prefix | Purpose |
|---|---|---|---|
| **Adviser** | `/[locale]/` | `adv_` | TCSP back-office (main platform) |
| **SFS Diamond** | `/sfsdiamond/` | `sfs_` | Memorial diamond jewellery e-commerce |

Admin console is at `/[locale]/admin/`. Roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`, `CLIENT`. Staff access is further restricted by per-menu permission keys and per-platform flags.

Admin left navigation is grouped by module. Menu groups can be collapsed/expanded, and only one group stays expanded at a time; the current route's group opens automatically, including company-scoped financial sub-routes under Finance Management. The bottom utility area, including Requirements / Feedback and Logout, stays fixed within the browser viewport while admin content scrolls independently.

---

## Adviser Admin Console

### 1. Dashboard (`/admin`)
Key metrics at a glance are grouped into a distinct Adviser corporate-services module: active companies count, pending KYC submissions, open AML alerts, annual filings due within 30 days. Each metric links to the relevant module.

### 2. Companies (`/admin/companies`)
Manages the full portfolio of client companies.
- List with search (name / code / registration number), status badge, assigned client, company incorporation date, **Annual Return Deadline** (incorporation month/day + 42 days, shown as `MM-DD`), financial-module toggle
- Company statuses: `ACTIVE`, `DORMANT`, `STRUCK_OFF`, `DEREGISTERED`
- Company create form uses **Company Jurisdiction** (`HONG_KONG`, `BVI`, `CAYMAN`, `MARSHALL`) for code-prefix jurisdiction
- Auto-generates company codes by company jurisdiction: `AA#####` (HK), `BV#####` (BVI), `CA#####` (Cayman), `MS#####` (Marshall)
- Company detail editing includes a separate **Company Type** field for legal/entity category values such as `private company limited by shares`, `public company limited by shares`, `company limited by guarantee`, `branch office`, `BVI`, `CAYMAN`, `BERMUDA`, and `MARSHALL`; this field is independent from the company jurisdiction and does not affect code generation
- Company create/edit includes **Financial Year End** (before Business Nature): March 31st or December 31st checkboxes (mutually exclusive); stored as month `3` or `12`
- Company detail overview shows Financial Year End above Business Nature, then **Annual Return Deadline** below Business Nature (incorporation month/day + 42 days, shown as `MM-DD`)
- Company detail overview includes a **文件管理** group with three toggles for `公司盒`, `公司方印`, and `公司圆印`; a single expand/collapse control beside the section title shows or hides all enabled items' IN/OUT forms and full movement history (collapsed by default); each enabled item can store dated `IN` / `OUT` movement records with handler and notes
- Create new company; assign client user, pending-client email, or **以後提供 / Provide later** (no client linked yet; can assign later on edit); assign staff; Registered Address has a **使用本公司地址** checkbox that fills `RM7 20F Boss Commercial Center 28 Ferry Street Yau Ma Tei Kowloon Hong Kong`
- Companies with the financial module enabled can optionally be assigned a **Financial Manager** from existing active back-office staff accounts; assignment can be left blank and filled later from the company edit form

**Company detail sub-pages** (`/admin/companies/[id]/...`):
- **Directors** — Register of Directors (ROD): add / edit / remove; date of appointment / cessation
- **Ownership Structure** — company detail People page shows an inverted tree chart above Directors: shareholders on top, the company at the bottom; corporate shareholders expand upward when their member name matches another company record; natural persons and companies are visually distinguished
- **Members** — Register of Members (ROM): shareholders with share class, share count, transfer history
- **Significant Controllers** — ROSC entries
- **Designated Representatives** — company representatives
- Generated ROD / ROM / ROSC documents automatically use linked KYC records as the source for natural persons' date of birth and place of birth
- **File Cases** — document groupings for long-term / other case files on the company Files tab; listed undated first, then newest `caseDate`, then newest created date; supporting files within a case follow submission/created date descending; upload / download documents (CI, BR, AA, NNC1, ROD, ROM, ROSC, AR, NAR1, AUDIT_TAX, DDR, RESOLUTION, MINUTES, KYC, OTHER)
- **Address Changes** — registered address change tracking; NND1 filing status
- **Shareholder Changes** — ownership change tracking with filing status
- **NAR1** — Annual return document upload (by year) and AI-assisted analysis/sync to company registers; no separate Annual Return Pre-fill download card
- **Annual Filings** — status: `NOT_STARTED`, `IN_PREPARATION`, `FILED`, `OVERDUE`
- **Document Analysis** — batch AI-assisted document review

Company-level staff access: multiple staff users can be assigned to a company via `company_staff_assignments`.

### 3. KYC Queue (`/admin/kyc`; Chinese admin nav label: 自然人管理)
Know Your Customer compliance workflow.
- List with search; columns: KYC code, name, client email, related companies (aggregated), documents, date, status; row click opens full-page detail at `/admin/kyc/[id]`
- Related companies on each KYC: companies under the same portal client account (`clientUserId` / `pendingClientEmail`), explicit `CompanyKeyPerson` links, and companies where this person is linked as director / member / significant controller; list shows first company +N; detail page lists all with role badges and links to company pages
- In the queue list status column, records with missing required KYC files show a red missing marker for ID proof, address proof, and/or declaration when the latest file for that type is absent or rejected
- KYC statuses: `DRAFT` → `SUBMITTED` → `PENDING_INFO` → `APPROVED` / `REJECTED`
- Full-page person detail (`/admin/kyc/[id]`): edit layout follows **KYC_Client.docx** sections A Client Identity, B Identity Document, C Occupation, D Financial Profile, F PEP, G Declaration (section E purpose-of-relationship not yet stored as dedicated fields); approve / reject / request info / cancel approval; delete returns to the queue
- After uploading `KYC_ID`, `KYC_ADDRESS`, and/or `KYC_DECLARATION`, staff can run **Analyze docs**: Bailian extracts fields from the latest of each type, merges into an editable **draft** (declaration wins over ID/address on conflicts); nothing is saved until Confirm & save
- **Four-step screening** on the KYC detail page (manual order): **1 AML (sanctions by name)** → CLEAR → **2 FATF** (nationality / passport-ID place of issue / place of birth vs bundled black/grey JSON) → CLEAR → **3 PEP (OpenSanctions `/match/peps`, needs `OPENSANCTIONS_API_KEY`)** → CLEAR → **4 Adverse media** is **only** in Screening step 4 (not in the Documents upload grid): staff search news offline, optional supporting upload (`KYC_ADVERSE_MEDIA`), then mark **CLEAR** or **HIT** manually; no Google API required → CLEAR; **Generate DDR** only when all four are CLEAR
- **Person DDR** (`generatePersonDDR`) and **Company DDR** (`generateDDR`) share a HK CDD layout exported as **Word (.docx)** with **6AM Advisory Limited** branding (wide header logo from `public/ddr-logo.png` ~300×47, PMingLiU body size 20, left-aligned Chinese body / centered cover titles, auto table borders): **(1) Client key information for screening** (identity + verified docs; **no separate Part 1.3** — adverse media is only under screening step 2.4) → **(2) Screening results & disposition** → **(3) Risk assessment items details** → **(4) Conclusion** (Item/Status checklist, overall risk, tall Approver Signature cell for wet-ink) → **(5) Data sources and notes** → **(6) Disclaimer**. Staff print the DOCX, sign Part 4, then upload the signed scan (PDF/JPG/PNG) for filing (`DDR` on company; `PERSON_DDR` on KYC).
- Person DDR uses stored `aml_checks` by scope and `AMLAlert` resolutions / evidence; adverse supporting files are `KYC_ADVERSE_MEDIA` and are listed under step 2.4
- Company DDR includes ownership look-through; screens **UBOs with effective ownership > 25%** (AMLO), plus **all natural-person directors** and **all natural-person significant controllers**; each linked KYC person shows four-step evidence + disposition; company entity shows latest company AML check; adverse media appears under each subject's Part 2 step (not a separate Part 1.3)
- Each KYC record captures: personal info, ID type/number, residential/correspondence address, employment, business nature, source of funds/wealth, asset declarations, PEP, US tax residency, declaration date
- Upload and verify supporting documents (proof of ID, proof of address, KYC declaration form, etc.)
- Approve or reject with written reasons
- View linked AML alerts directly from the KYC record
- Export KYC data
- Generate compliance documents: Due Diligence Reports (DDR) as Word `.docx` (print/sign/upload); KYC summaries as DOCX

### 4. AML&PEP篩查 (`/admin/aml`)
Anti-Money Laundering and PEP screening and alert management. Admin nav/page title: `AML&PEP篩查` (EN: AML & PEP Screening).
- Subjects: individuals (key persons) and entities (companies)
- Check result levels: `CLEAR`, `WEAK_HIT`, `POTENTIAL_HIT`, `STRONG_HIT`
- Alert resolution workflow: `PENDING` → `FALSE_POSITIVE` (continue CDD) / `ESCALATED` (start EDD) / `REJECTED` (terminate or refuse — no EDD). Legacy `CONFIRMED` retained for historical alerts only
- Alert details: match score, aliases, addresses, ID numbers, listing reason and date, source list info
- Review: add notes, optionally upload supporting evidence (PDF/JPG/PNG; use `templates/AMLO_Hit_Disposition_Memo.docx` for the AMLO officer memo), mark resolution (`FALSE_POSITIVE` / `ESCALATED` / `REJECTED`); evidence is stored on the alert and downloadable after resolve
- Reject disposition actions (policy): stop onboarding / refuse service; terminate existing relationship if established; notify client in writing where applicable; assess whether separate JFIU contact is required — without starting EDD
- Escalated disposition: begin enhanced due diligence (EDD), not rejection
- Data sources: XML, CSV, XLSX, JSON list formats; each source tracks last fetch date
- Sanctions list status shows the original 13 sanctions sources (seq 1–13); each source row expands to preview up to 50 DB records
- Below that, a separate FATF Lists panel (always shown) expands to FATF 黑名單（呼籲採取行動／Call for Action）and FATF 灰名單（加強監控／Increased Monitoring）; each list expands to show jurisdiction names, aliases, listing reason and date from bundled JSON (FATF has no machine-readable export); update JSON after each FATF plenary
- Below FATF, a **PEP Screening** panel notes that PEP checks run live via the **OpenSanctions.org Match API** (`/match/peps`, needs `OPENSANCTIONS_API_KEY`) — not a locally ingested list
- Adverse media / news: **person KYC step 4 is manual** (staff mark CLEAR/HIT; optional `KYC_ADVERSE_MEDIA` uploads). DDR **step 2.4** states PASS/FAIL, completion time, and lists supporting files. Google Custom Search remains optional for legacy company/news findings when CSE keys are set; hits in `adverse_media_findings` are not the primary DDR 2.4 source
- Trigger modes: manual (screen a subject on demand), KYC-triggered (auto-runs on KYC submission), scheduled cron
- Ingest new AML lists from URL or local file

### 5. Financial Accounting (`/admin/financial`)
Full double-entry accounting system per client company, compliant with HKFRS.

**Company selection**: select a client company (or consolidated report group) before accessing financial sub-pages. Selection is persisted in `localStorage`. Confirmed with a two-step OK button. If the stored company selection is stale or no longer accessible, the financial pages automatically clear it and send the user back to the company selector instead of loading an empty report for an invalid company ID.

Sub-pages (all scoped to a selected company or at `/admin/financial/[companyId]/`):

- **Chart of Accounts** (`/accounts`): hierarchical accounts up to 4 levels; account types: `ASSET` (流动资产), `NON_CURRENT_ASSET` (长期资产), `LIABILITY` (流动负债), `NON_CURRENT_LIABILITY` (长期负债), `EQUITY`, `REVENUE`, `EXPENSE`, `CGS`, `CURRENT_ACCOUNT`; when a company has no accounts yet, opening the page auto-seeds 9 standard level-1 accounts (`01` 现金与银行, `02` 应收, `03` 应付, `04` 权益, `05` 收入, `06` 成本, `07` 行政费用, `08` 销售费用, `09` 财务费用) plus `0401` 本年利润 under `04` 权益; create / edit / delete; parent-account picker in the create/edit dialog shows each option as `code - name` with visual level indentation (not internal IDs); system accounts are locked; opening balance with debit/credit direction and account-level year-to-date cumulative debit and credit amounts can be created and edited on any leaf account (including level-1 accounts with no sub-accounts); accounts named `本年利润` / `本年利潤` automatically show year-to-date balance as credit amount minus debit amount in the form and account list; parent accounts with children do not accept separate opening balances or year-to-date cumulative amounts, and instead display read-only rolled-up totals from all descendant leaf accounts; when a leaf account becomes a parent, its own entered opening and cumulative amounts are cleared so the parent total comes only from children; accounts with opening balances can still be deleted when no journal entries reference them, and deletion clears their opening-balance records
- **Journal Entries** (`/journal`): create balanced vouchers with multi-line debits/credits; line detail columns show line description before account; account column opens a tree picker dialog showing level-1 / level-2 / level-3 account hierarchy, keeps manual fuzzy search by account code or name inside the dialog, labels selectable accounts as `code - name`, shows each selectable account's current debit/credit balance on the right using the same real-time posted-journal + imported-balance + YTD roll-up basis as the trial balance, and allows level-2 and level-3 accounts plus the level-1 account itself when it has no children; the create/edit form places the voucher summary beside the date field, exposes entry source type as radio buttons (**手工录入** default, or **期末结转**), and uses enlarged line rows and wider input areas (科目、借方、贷方等字段) for easier data entry; in the entry form use **↑/↓** to move focus between line rows (**↓** on the last row adds a new line), **Enter** to confirm the current line and jump to the next (on the last line **Enter** saves the voucher), and **F1** to save the current voucher and clear the form for the next entry (date and company are kept — date defaults to the last successfully saved entry date, not today); after creating or editing a voucher, users can save and print the formal journal voucher, and can also print existing vouchers from the list or detail dialog; journal voucher print output is a concise A4 sheet with no browser page header/footer and no separate voucher title block — it starts with voucher metadata (voucher no, status, company, date, description, creator), followed by a line table **行 / 行摘要 / 科目 / 借方 / 贷方** with a bottom **合计** row; the list combines date and voucher summary in one compact column, displays source type as **手工** or **结转** (subledger-generated automatic entries show **自动**), supports searching by voucher number, voucher summary, line summary, account code, or account name, and the list detail dialog still shows **一级科目 / 二级科目 / 三级科目** columns with the full account hierarchy (`code name` per level, dash when that level is unused) so level-3 postings are visible in context; list supports checkbox multi-select, **batch post** for selected DRAFT entries, and **一键全部过账** for all DRAFT entries in the current list (posted in entry-date order); statuses: `DRAFT` → `POSTED` / `CANCELLED`; posted manual and period-closing vouchers can be **撤销过账** to delete their derived ledger rows and return to `DRAFT` for editing; cancelled vouchers can be reopened from the list or detail dialog, edited, and saved back to `DRAFT` for re-posting; support attachments; post to ledger; cancel/reverse entries; permanently delete already-cancelled entries to remove the voucher and its lines instead of keeping a cancelled record; grouped by period (YYYY-MM); Excel import for historical journal entries. Recommended line-import column order is `Date`, `Voucher Number`, `Account Code`, `Account Name`, `Particular`, `Debit`, `Credit`; blank voucher numbers auto-generate `JE-YYYYMMDD-###`, blank account codes fall back to matching by `Account Name` or auto-creating a new chart account under the inferred root, and legacy account-name rows (`Date`, `Account`, `Particular`, `Debit`, `Credit`) still import with the same name-match/auto-create behavior. Paired rows (`Date`, `Description`, `Debit Account Code`, `Credit Account Code`, `Amount`) are also supported. Imported entries are saved as Pending/DRAFT for review before posting.
- **General Ledger** (`/ledger`): account activity with running balances; entries are grouped by account code and sorted by date within each account; each account group's header row shows account code, account name, and account type (e.g. `ASSET 流动资产`, `LIABILITY 流动负债`) so accountants can quickly identify the category; each account group starts with a **期初余额** row (or the opening balance at the selected period/date range start), and running balances are recalculated from the account opening balance plus posted debit/credit movements rather than relying on stored ledger snapshots; balances are displayed as separate debit-balance and credit-balance columns, and fully offset debit/credit movements display as `0.00` rather than negative zero; filter by account type, period, custom start/end date range, voucher number, and a three-level cascading account selector (level 1 → level 2 → level 3) that displays placeholders, selected values, and account options as user-facing text (`code - name`, not internal IDs) and includes the selected account's descendant detail accounts; below the cascade selector, users can type an account code (e.g. `1001`, `1300`) and click **搜索科目** or press **Enter** to jump directly to that account and show its ledger activity (including descendant accounts when applicable); each posted voucher number has a small link button beside it that opens the corresponding journal entry detail dialog on the Journal Entries page
- **HKFRS Reports** (`/reports`): trial balance, income statement (P&L), balance sheet, cash flow statement generated from posted journal-entry lines (ledger rows are derived records); amounts on screen and in Excel/CSV export show as plain numbers with two decimal places (no currency code or symbol such as HKD / USD / RMB); trial balance period movement columns are labelled **本期借方** / **本期贷方**, and closing balances follow each account type's normal debit/credit direction (for example `LIABILITY` balances display as credit balances); trial balance shows a tree-style account list: level-1 summary rows (marked「一级汇总」) can be expanded inline to reveal level-2 rows, and level-2 rows with children can expand to level-3+ rows; collapsed parent rows show rolled-up period debit/credit and closing balances; a **科目层级** selector can still limit the available display scope to **仅一级科目**, **前两级科目**, or **全量明细** (debit/credit totals always reflect all level-1 accounts regardless of filter); level-1 summary rows and leaf level-1 detail rows are counted in the trial-balance debit/credit totals, while descendant level-2+ detail rows are not counted; leaf level-1 accounts without sub-accounts still appear as regular detail rows; trial balance does not append a computed `本年利润` / `本年利潤` period-end profit row; rows are sorted by chart-of-accounts `sortOrder`; when chart-of-accounts entries are created, edited, or deleted, the reports page for the same company auto-refreshes without clicking the generate button (including when accounts and reports are open in separate browser tabs); balance sheet follows HKFRS presentation with non-current/current asset and liability groupings plus an equity section (assets: 非流动资产 → 流动资产; liabilities and equity: 所有者权益 → 非流动负债 → 流动负债); balance-sheet current/non-current grouping follows account type first (`ASSET` = current asset, `NON_CURRENT_ASSET` = non-current asset, `LIABILITY` = current liability, `NON_CURRENT_LIABILITY` = non-current liability), while `CURRENT_ACCOUNT` is classified by balance direction: debit balance shows as current asset and credit balance shows as current liability, regardless of account code; regular asset/liability accounts remain in their configured account-type sections even when their balance is negative, so negative asset or liability rows indicate the underlying account balance direction rather than automatic reclassification; balance sheet **defaults to level-1 summary rows only** (amounts roll up into their level-1 parent), no longer shows a separate computed `3999 本期利润` / `Profit for the period` line, but formal equity totals include the cumulative unclosed P&L needed to close the balance sheet as a visible equity line: it is folded into an existing `本年利润` / `本年利潤` / `Current Year Profit` account when present, otherwise shown as a generated `本期利润` row; that row includes an explanatory note and the exact cumulative unclosed P&L amount on screen and in Excel export, calculated from P&L source data rather than plugged from the balance-sheet difference; users can **expand** a level-1 row that has sub-accounts to reveal level-2+ detail lines inline; trial balance shows only account lines with period and closing debit/credit amounts, plus **借方合计** / **贷方合计** and a **已平衡** / **不平衡** badge (with warning when debit and credit totals differ); it does **not** show asset/liability/equity subtotals or accounting-equation validation on screen or in trial-balance CSV/Excel export; balance sheet automatically validates the accounting equation **Assets = Liabilities + Equity** using displayed equity rows including cumulative unclosed P&L and shows asset/liability/equity subtotals with a clear difference amount and warning when unbalanced; cash-flow financing activity classification uses `EQUITY` and `NON_CURRENT_LIABILITY` account types rather than liability code ranges; supports exporting all four statements into one Excel workbook
- **Historical Ledger Books** (`/history`): company-scoped archive for historical financial workbooks. Admins can upload `.xlsx` / `.xls` files such as historical account balance tables and opening-balance packs; the system stores the original file and a sheet/row/header preview for viewing and download only. Uploaded historical ledger books are not imported into current chart-of-accounts balances, journals, ledgers, fiscal periods, or reports.
- P&L displays income statement sections in this order: revenue, main business cost / cost of sales, gross profit, expense details, net profit. It uses the selected accounting period's posted journal-line debit/credit movements keyed by `JournalEntry.period` (for example, a `2026-05` report uses vouchers posted into accounting period `2026-05`); for legacy/imported financial data without posted journal entries, it also falls back to imported `yearToDateAmount` and account-balance closing debit/credit amounts so P&L can match the trial-balance figures users can already see. Revenue is always calculated as credit minus debit and displays as a positive amount when credits exceed debits, while CGS and expenses are debit minus credit. P&L detail rows show the source period movement columns **本期借方** and **本期贷方** alongside the statement amount. Revenue totals include direct postings to level-1 revenue accounts such as `主营业务收入`. P&L normally follows account types `REVENUE`, `CGS`, and `EXPENSE`; for legacy/imported charts where those types are missing, it also recognizes common income-statement account codes and names (for example `05`/`4xxx` income, `06`/`5xxx` cost of sales, `07`/`08`/`09`/`6xxx` expenses), but accounts explicitly typed as balance-sheet accounts (`ASSET`, `LIABILITY`, `EQUITY`, `CURRENT_ACCOUNT`, etc.) are not reclassified into P&L by code alone unless the account name clearly matches income/cost/expense keywords. For P&L accounts, if a level-1 account has level-2 accounts, line detail shows level-2 rolled-up amounts plus any direct level-1 postings; if a level-1 account has no level-2 accounts, it shows the level-1 amount. Any active P&L account with monthly movement that is not covered by those normal statement levels is still included. Expense details are grouped into `销售费用`, `管理费用`, and `财务费用`, each with its own subtotal plus an overall expense total.
- **Consolidated Report Groups** (on selector page): named portfolios grouping multiple companies for consolidated reporting; create / delete groups; groups do not own journal entries (reporting only)
- **Account Mappings** (API `/api/admin/financial/account-mappings`): per-company posting-rule mapping (default revenue/expense, tax, bank/cash); for newly initialized companies, unmapped rules fall back to the 9 standard level-1 account codes when not configured
- **Fiscal periods**: periods (YYYY-MM) can be CLOSED/LOCKED per company; posting into a closed period is blocked

Financial module can be enabled/disabled per company via the `financialEnabled` flag. Non-`SUPER_ADMIN` users only see and operate financial companies where they are assigned as that company's Financial Manager; unassigned companies must be assigned before regular staff can perform bookkeeping/financial operations. The financial admin UI is localized in Chinese. The `/admin/financial` company selector shows each company's assigned Financial Manager name (from `company_staff_assignments`, with fallback to the company record) in the dropdown list and below the selected company trigger.
Staff users in Adviser financial pages are read-only by default: they can open financial pages within their assigned company scope, view ledgers and documents, print vouchers, and export reports/Excel data. Chart-of-Accounts create/edit/delete can be enabled for a staff account through the button-level permissions `financialAccounts.create`, `financialAccounts.edit`, and `financialAccounts.delete` (with company access/financial-manager scope still enforced); other financial mutations remain blocked unless their routes explicitly support the matching button-level permission.

### 6. Invoices (`/admin/invoices`)
Service invoicing for TCSP professional fees.
- List with search, status filter
- Invoice statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Create invoices for either a linked client company or an approved personal KYC identity; billing fields are auto-filled from the selected customer and can be manually adjusted; line items support description, quantity, unit price, and an optional per-line discount entered either as a percentage or a fixed amount; each line can also link to a TCSP service-price entry to auto-fill description and unit price while still allowing later manual edits that only affect the invoice snapshot; the form remains no-tax (`0%`) and the editor no longer shows a separate tax line under the subtotal/total summary; the line-item editor uses a wider multi-line description field with quantity/unit-price controls grouped beside it; the new-invoice form includes due-date quick options for `月结`, `月结30天`, and `月结60天`, which calculate and fill the due date from the issue date (or today if the issue date is empty)
- Edit DRAFT invoices from the invoice detail page, including billing fields, dates, notes, and line items; status changes remain available there
- Generate and download PDF; the PDF uses global 6AM Advisory sender contact details in the header and Bank of China (Hong Kong) / FPS payment instructions in the footer
- Upload historical invoice PDFs from the invoice list via **添加历史发票**; admins can add/edit a text note for each uploaded historical PDF and the note is shown directly in the historical-file list; uploaded historical files are stored as downloadable archives and do not create or modify formal invoice records, numbering, totals, or statuses
- Link invoices to client companies or approved individual KYC records

### 6b. Contracts (`/admin/contracts`)
Independent Adviser contract management, not linked to client companies.
- Upload and download contract files (PDF, Word, JPG, PNG, WEBP; max 10 MB; Chinese file names are preserved for download)
- Contract metadata includes contract name, start date, end date, and notes; metadata can be edited after upload
- Access and actions are controlled by Role Management permissions `contracts`, `contracts.create`, `contracts.edit`, and `contracts.delete`

### 6c. TCSP Service Pricing (`/admin/tcsp-pricing`)
Central price-list management for TCSP service quotes.
- Maintains service pricing by jurisdiction (`HK`, `BVI`, `CAYMAN`, `MARSHALL`), customer level (`经销客户` / `普通客户`), free-text service content, currency, amount, and notes
- Service content is a single admin-entered description field, so admins can cover any current or future TCSP service without selecting a preset category or item
- The same jurisdiction + customer level + service content combination is unique to prevent duplicate quote rows
- Access and actions are controlled by Role Management permissions `tcspPricing`, `tcspPricing.create`, `tcspPricing.edit`, and `tcspPricing.delete`

### 7. Team Management (`/admin/team`)
Staff access control.
- System roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`
- Per-staff platform access flags (Adviser / SFS Diamond)
- Granular admin-menu permission keys (companies, kyc, aml, financial, invoices, contracts, tcspPricing, team, feedback, sfs-customers, sfs-orders, sfs-invoices)
- Dynamic role assignment: each staff member can be assigned multiple dynamic `AdminRole` records (from Role Management); effective access is the union of all selected roles' page + button-level permissions
- Legacy mode: no restrictions; new mode: explicit per-menu grants
- Create / edit / deactivate staff accounts
- Active `STAFF`, `COMPLIANCE`, and `SUPER_ADMIN` accounts can be selected as per-company Financial Managers from Company Management; this assignment controls financial-operation authority for enabled companies

### 7b. Role Management (`/admin/admin-roles`)
Dynamic permission roles. **SUPER_ADMIN only.**
- Create, edit, delete custom roles with name, color, and description
- Each role has a permission matrix covering all admin pages across all modules (Adviser, SFS Diamond, System); every newly added admin page or feature entry must be added to Role Management in the same change
- Permissions are per-page (list/menu view access) and per-action (view detail, create, edit, delete, approve, export, import)
- System roles cannot be deleted
- Assigned to staff via Team Management; effective permissions = role permissions + direct menu key grants

### 8. User Accounts (`/admin/users`)
Client portal account management.
- View and manage `CLIENT` role accounts
- Link clients to their companies
- Account activation; email verification status

### 9. Requirements / Feedback (`/admin/feedback`)
AI-powered feature request management. **SUPER_ADMIN only.**
- Lists all submitted feature requests with title (LLM-generated), summary, priority, status, submission date
- Statuses: `PENDING` → `ACCEPTED` → `IN_PROGRESS` → `DONE` / `REJECTED`; PENDING items are internal-only and not visible to external dev-tool systems; admin clicks Accept to promote to ACCEPTED before external pickup
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
- Assigned companies list no longer shows company master-file annual return dates

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
- **Order** (`/order`): public order placement form; Diamond Specs options are database-driven from SFS Diamond Specs admin, including image-backed Source / Color / Carat / Shape / Ring Design / Necklace Design / Earring Design / Bracelet Design options (source, color, and carat steps show preview thumbnails; carat falls back to generated visual size previews when no image is uploaded); setting types include Ring, Necklace, Earring, Bracelet, and Diamond only; selecting Earring shows only the Earring Design customer option group; **option prices and estimated order totals are shown live** (global catalog, or personalised when the logged-in client has price overrides); anonymous submissions create an order and SFS customer record, while logged-in SFS clients also get the order linked to their account
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
- **Customer-differentiated pricing** (edit dialog **Client price list**): full table by category comparing **global** Diamond Specs prices vs this client’s prices; blank = use global; saved values replace the global price for quoting / invoicing / the client order form
- Logged-in SFS clients see **live option prices and estimated totals** while placing an order (`/sfsdiamond/order`); guests see global catalog prices; personalised lists apply when the account has a bound SfsCustomer with overrides

### SFS Diamond Specs Admin (`/admin/sfs-diamond-specs`)
Customer-facing order option management for SFS Diamond.
- Page opens with the **Source** category filter selected by default; admins can switch to All or any other category tab
- Maintains active/inactive options for Source, Color, Carat, Shape, Setting Type, Ring Design, Necklace Design, Earring Design, Bracelet Design, and Metal
- Source, Color, Carat, Shape, Ring Design, Necklace Design, Earring Design, and Bracelet Design options can store preview image URLs; admin can upload images to OSS/local storage or paste an existing URL
- Active options are shown on `/sfsdiamond/order`; submitted orders keep saved text values
- **Pricing**: each spec option has a price whose meaning depends on category — CARAT = diamond base price, SOURCE/COLOR/SHAPE/METAL = additive adjustment (may be negative), each design (Ring/Necklace/Earring/Bracelet) = its own jewellery price (finer than Setting Type); unset price counts as 0
- Diamond pricing model (per diamond): `(caratBase + sourceAdj + colorAdj + shapeAdj)` for the diamond portion, plus the design price + metal adjustment for the jewellery portion; per-customer overrides replace the matching global prices

### SFS Orders Admin (`/admin/sfs-orders`)
Order lifecycle management for memorial diamond commissions.
- List with search (client name / email / sample code) and **status filter** chips (`All` / `PENDING` / `QUOTED` / `CONFIRMED` / `COMPLETED` / `CANCELLED`); columns: status, sample code, memorial name, client, source type, colour, diamond count, creation date
- Staff with permission `sfsOrders.delete` (角色管理 → 订单 → 删除) can permanently delete orders from the list or order detail; deletion removes production steps/images and unlinks (does not delete) related invoices; Super Admin always has this permission
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
- Order steps: create / update / complete sub-tasks within Chemical Transformation (**12**), CVD Growth (**5** — Day-21 check removed; ends with Labeling), Crafting (**4**), and Jewelry Setting (**2**); each order has a per-order step plan (defaults to the standard predefined steps); staff with independent permission `sfsOrders.manageSteps` (角色管理 → 订单 → 管理步骤) can insert custom steps between any positions, remove predefined or custom steps, and reset a phase to defaults; completing a step links it via `planStepId`
- Chemical Transformation phase defaults begin with **Package Received**, then **Package arrived production site**, Check Sample & Labeling, and the remaining NL00001 workflow steps (including a weight-capture step)
- Completed step attachments: uploaded images display at 224×224px (4× the previous thumbnail size) for easier admin review
- Production step images uploaded in Chemical Transformation, CVD Growth, Crafting, and Jewelry Setting require manual review (`PENDING` / `APPROVED` / `REJECTED`); staff uploads are auto-marked `PENDING` and await `SUPER_ADMIN` approval; only `APPROVED` images are visible to SFS clients and included in customer production reports; `PENDING` and `REJECTED` images are hidden from clients; approval creates a customer notification

### SFS Invoices Admin (`/admin/sfs-invoices`)
- Invoices linked to SFS orders
- Statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Auto-generated invoice numbers: 8-digit pure numeric format `YY######` (e.g. `26000001`, `26000002`), sequential within each calendar year; shown in the list table column and in the page header (top-right) on new and detail pages
- Create from order; edit DRAFT; generate and download PDF
- When creating an invoice from an order, each diamond line item's **unit price is auto-suggested by the pricing engine** (diamond carat/color/shape/source base + per-design jewellery price + the order customer's price overrides); suggested prices remain fully editable before saving
- Admin invoice screens keep line-item display focused on description, quantity, weight, unit price, and amount; due date and tax-rate display are hidden from the SFS invoice UI
- PDF issuer header: **SFS Technical Group Co., Limited / 瑞福生科技集團有限公司**, with fixed address **RM7 20F BOSS COMMERCIAL CENTRE 28 FERRY STREET YAU MA TEI KOWLOON** below the company name
- PDF payment block (footer): DBS BANK (HONG KONG), SWIFT DHBKHKHH, Bank Code 016, Account Number 478002236556, A/C Name SFS TECHNOLOGY GROUP CO., LIMITED

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

### Internationalisation
- Supported locales: `en`, `zh-HK`
- All Adviser and client portal pages are localised via `next-intl`
- SFS Diamond public pages are not locale-prefixed
