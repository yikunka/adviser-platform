# Adviser Platform — System Knowledge

## Overview

A multi-platform back-office system operated by a licensed TCSP (Trust and Company Services Provider) firm. Two independent platforms share one Next.js codebase and one PostgreSQL database:

| Platform | URL prefix | DB prefix | Purpose |
|---|---|---|---|
| **Adviser** | `/[locale]/` | `adv_` | TCSP back-office (main platform) |
| **SFS Diamond** | `/sfsdiamond/` | `sfs_` | Memorial diamond jewellery e-commerce |

Admin console is at `/[locale]/admin/`. Roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`, `CLIENT`. Staff access is further restricted by per-menu permission keys and per-platform flags.

Admin left navigation is grouped by module. Menu groups can be collapsed/expanded, and only one group stays expanded at a time; the current route's group opens automatically, including company-scoped financial sub-routes under Finance Management. The bottom utility area, including Requirements / Feedback and Logout, stays fixed within the browser viewport while admin content scrolls independently. Top-right **Day / Night** toggle switches between night (black × gold) and day (cool light gray × gold accent) UI; preference is stored in the browser.

---

## Adviser Admin Console

### 1. Dashboard (`/admin/dashboard`)
Key metrics at a glance, grouped by platform module:
- **Adviser**: active companies, pending KYC submissions, open AML alerts, annual filings due within 30 days; **做帐进度** for financial-enabled companies (last posted journal month, 未做帐 / months behind); each metric links to the relevant module
- **SFS Diamond** (shown when the staff user has any SFS admin menu): actionable KPIs for pending quote, confirmed in-production, step images awaiting review, CVD expected-end within 7 days, orders awaiting invoice, and new orders this month; a merged to-do list (oldest/urgent first) for quote / image review / CVD due; quick links to Customers, Orders, Price management, Diamond specs, and Invoices (permission-filtered)

### 2. Companies (`/admin/companies`)
Manages the full portfolio of client companies.
- List with search (name / code / registration number), status badge, assigned client, company incorporation date, **周年申报截止日** (incorporation month/day + 42 days, shown as `MM-DD`), **現任董事** (active directors; Chinese name if present, otherwise English), **UBO** (look-through natural persons with effective ownership > 25%, name + %), financial-module toggle
- Company statuses: `Active`, `Inactive`, `Deregistered`
- Company create/edit uses **Jurisdiction** (`Hong Kong`, `BVI`, `Cayman`, `Bermuda`, `Marshall`, `PRC`) for code-prefix jurisdiction (`AA` / `BV` / `CA` / `BM` / `MS` / `PR`)
- Company list shows a **註冊地** column with English jurisdiction labels (Hong Kong / BVI / Cayman / Bermuda / Marshall / PRC) and has jurisdiction + status filters next to search
- Auto-generates company codes by jurisdiction: `AA#####` (HK), `BV#####` (BVI), `CA#####` (Cayman), `BM#####` (Bermuda), `MS#####` (Marshall), `PR#####` (PRC)
- Company detail editing includes a separate **Company Type** field for legal/entity category values: `Private Company Limited by Shares`, `Public Company Limited by Shares`, `Company Limited by Guarantee`, `Private Unlimited Company`, `Public Unlimited Company`, and `Branch Office`; this field is independent from **Jurisdiction** and does not affect code generation
- Company create/edit includes **Financial Year End** (before Business Nature): March 31st or December 31st checkboxes (mutually exclusive); stored as month `3` or `12`
- Company detail overview shows Financial Year End above Business Nature, then **周年申报截止日** below Business Nature (incorporation month/day + 42 days, shown as `MM-DD`)
- Company detail overview includes a **文件管理** group with three toggles for `公司盒`, `公司方印`, and `公司圆印`; a single expand/collapse control beside the section title shows or hides all enabled items' IN/OUT forms and full movement history (collapsed by default); each enabled item can store dated `IN` / `OUT` movement records with handler and notes
- Company create/edit **Service Tier** is multi-select checkboxes: `Comp Set Up`, `Comp Secretary Service`, `Virtue Office`, `Acct Service`, `Other Service` (stored as `serviceTiers` string array; legacy single tiers CS / CS+VO / CS+BK / CS+VO+BK migrated on deploy)
- Create new company; assign client user, pending-client email, or **以後提供 / Provide later** (no client linked yet; can assign later on edit); assign staff; Registered Address has a **使用本公司地址** checkbox that fills `RM7 20F Boss Commercial Center 28 Ferry Street Yau Ma Tei Kowloon Hong Kong`
- Companies with the financial module enabled can optionally be assigned a **Financial Manager** from existing active back-office staff accounts; assignment can be left blank and filled later from the company edit form

**Company detail sub-pages** (`/admin/companies/[id]/...`):
- **Directors** — Register of Directors (ROD): add / edit / remove; date of appointment / cessation; can link a **KYC person**; list shows Link column (KYC / Corporate / —)
- **Members** — Register of Members (ROM): shareholders with share class, share count, transfer history; list shows latest transaction **Date** and **Type** (Allotment / Transfer in / Transfer out); staff can **append** new allotment/transfer rows without overwriting earlier history; latest `sharesHeld` drives ROM %, ownership chart, and ROSC sync; when latest holding is 0 the member status becomes `TRANSFERRED_OUT`; Add/Edit Member can link a **KYC person** (natural person) or a **portfolio company** (corporate shareholder); links are mutually exclusive; ownership look-through prefers explicit company links over name matching
- **Ownership Structure** — company detail People page shows an inverted tree chart above Directors: shareholders on top, the company at the bottom; corporate shareholders expand upward when linked via `linkedCompanyId` or when their member name matches another company record; natural persons and companies are visually distinguished; company nodes show jurisdiction (Hong Kong / BVI / Cayman / Bermuda / Marshall / PRC) when set; only members whose latest shareholding is still &gt; 0 appear on the chart
- **Significant Controllers** — ROSC entries; Add/Edit Controller can link a **KYC person** or a **portfolio company** (legal-entity controller); company link sets legal-entity mode and clears KYC link; ACTIVE members with direct shareholding **>25%** are auto-synced into ROSC on member create/update/delete (and via **Sync from Members >25%**); nature of control set to shareholding %; does not delete existing controllers
- **Designated Representatives** — company representatives; Add/Edit can link a **KYC person**; list shows Link column (KYC / —)
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
- Related companies on each KYC: companies under the same portal client account (`clientUserId` / `pendingClientEmail`), explicit `CompanyKeyPerson` links, and companies where this person is linked as director / member / significant controller / designated representative; list shows first company +N; detail page lists all with role badges and links to company pages
- In the queue list status column, records with missing required KYC files show a red missing marker for ID proof, address proof, and/or declaration when the latest file for that type is absent or rejected
- KYC statuses: `DRAFT`, `APPROVED`, `REJECTED`, `INACTIVE` (legacy `SUBMITTED` / `PENDING_INFO` migrated to `DRAFT`)
- Admin can Approve / Reject / Mark Inactive from the detail page; Cancel Approval returns to `DRAFT`; status can also be set in Edit
- Client portal submit keeps status as `DRAFT` (awaiting staff review); approved and inactive records are locked from client edits
- **Quarterly DDR (manual)**: calendar quarters (Q1–Q4). Monthly auto company DDR cron is **disabled**. Staff generate company `DDR` / person `PERSON_DDR` manually each quarter (adverse media remains manual). Admin **dashboard** lists **due this quarter** and **overdue** items for ACTIVE companies (soft reminder) and **APPROVED** persons missing current-quarter DDR; pending KYC count uses `DRAFT`
- Full-page person detail (`/admin/kyc/[id]`): **备注 / Admin Notes** (free-text, staff-only, for info not on uploaded documents; saved independently above Client Identity); edit layout follows **KYC_Client.docx** sections A Client Identity, B Identity Document, C Occupation, D Financial Profile, F PEP, G Declaration (section E purpose-of-relationship not yet stored as dedicated fields); approve / reject / mark inactive / cancel approval; delete returns to the queue
- After uploading `KYC_ID`, `KYC_ADDRESS`, and/or `KYC_DECLARATION`, staff can run **Analyze docs**: Bailian extracts fields from the latest of each type, merges into an editable **draft** (declaration wins over ID/address on conflicts); nothing is saved until Confirm & save
- **Four-step screening** on the KYC detail page (manual order): **1 AML (sanctions by name)** → CLEAR → **2 FATF** (nationality / passport-ID place of issue / place of birth vs bundled black/grey JSON) → CLEAR → **3 PEP (OpenSanctions `/match/peps`, needs `OPENSANCTIONS_API_KEY`)** → CLEAR → **4 Adverse media** is **only** in Screening step 4 (not in the Documents upload grid): staff search news offline, optional supporting upload (`KYC_ADVERSE_MEDIA`), then mark **CLEAR** or **HIT** manually; no Google API required → CLEAR; **Generate DDR** only when all four are CLEAR
- **KYC approve hard gate**: cannot set KYC to `APPROVED` unless a `PERSON_DDR` document exists with `uploadedAt` in the **current calendar quarter**; complete screening → generate person DDR → then approve
- PEP step 3 embeds OpenSanctions PEP **alerts** with **Review alert →** links to `/admin/aml/[id]` (AML&PEP screening); when PEP returns a hit, staff can **手动通过 PEP** after entering disposition notes — writes a CLEAR PEP check (`manualPass`), marks pending PEP alerts as `FALSE_POSITIVE`, and unlocks Adverse media
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
- P&L displays income statement sections in this order: revenue, main business cost / cost of sales, gross profit, expense details, net profit. It uses the selected accounting period's posted journal-line debit/credit movements keyed by `JournalEntry.period` (for example, a `2026-05` report uses vouchers posted into accounting period `2026-05`); for legacy/imported financial data without posted journal entries, it also falls back to imported `yearToDateAmount` and account-balance closing debit/credit amounts so P&L can match the trial-balance figures users can already see. Revenue is always calculated as credit minus debit and displays as a positive amount when credits exceed debits, while CGS and expenses are debit minus credit. P&L detail rows and section totals show **本期金额** / **本期合计** (selected period net) and **本年度总金额** / **本年度合计** (calendar year-to-date through the selected period, excluding period-closing `CLOSING` vouchers); Excel export uses the same columns. Revenue totals include direct postings to level-1 revenue accounts such as `主营业务收入`. P&L normally follows account types `REVENUE`, `CGS`, and `EXPENSE`; for legacy/imported charts where those types are missing, it also recognizes common income-statement account codes and names (for example `05`/`4xxx` income, `06`/`5xxx` cost of sales, `07`/`08`/`09`/`6xxx` expenses), but accounts explicitly typed as balance-sheet accounts (`ASSET`, `LIABILITY`, `EQUITY`, `CURRENT_ACCOUNT`, etc.) are not reclassified into P&L by code alone unless the account name clearly matches income/cost/expense keywords. For P&L accounts, if a level-1 account has level-2 accounts, line detail shows level-2 rolled-up amounts plus any direct level-1 postings; if a level-1 account has no level-2 accounts, it shows the level-1 amount. Any active P&L account with monthly movement that is not covered by those normal statement levels is still included. Expense details are grouped into `销售费用`, `管理费用`, and `财务费用`, each with its own subtotal plus an overall expense total.
- **Consolidated Report Groups** (on selector page): named portfolios grouping multiple companies for consolidated reporting; create / delete groups; groups do not own journal entries (reporting only)
- **Account Mappings** (API `/api/admin/financial/account-mappings`): per-company posting-rule mapping (default revenue/expense, tax, bank/cash); for newly initialized companies, unmapped rules fall back to the 9 standard level-1 account codes when not configured
- **Financial Settings** (`/admin/financial/[companyId]/settings`, menu **财务设置**): per-company **report structure** for 利润表 and 资产负债表 — choose which chart-of-accounts rows make up each statement category (营业收入 / 营业成本 / 销售·管理·财务费用；流动/非流动资产与负债；所有者权益). Selecting a parent includes descendants. If a statement has no custom mappings, reports keep the previous type/code/name heuristics. Actions: save, clear (revert to heuristics), initialize suggestions from heuristics. Mutations require financial manager (or Super Admin). Permission key `financialSettings` (edit).
- **Fiscal periods**: periods (YYYY-MM) can be CLOSED/LOCKED per company; posting into a closed period is blocked

Financial module can be enabled/disabled per company via the `financialEnabled` flag. Non-`SUPER_ADMIN` users only see and operate financial companies where they are assigned as that company's Financial Manager; unassigned companies must be assigned before regular staff can perform bookkeeping/financial operations. The financial admin UI is localized in Chinese. The `/admin/financial` company selector shows each company's assigned Financial Manager name (from `company_staff_assignments`, with fallback to the company record) in the dropdown list and below the selected company trigger. The admin dashboard (`/admin/dashboard`) shows a **做帐进度** list for financial-enabled companies in the staff member's company scope: **最后做帐月份** is the latest posted journal period; companies with no posted journals show **未做帐**, and companies behind the previous calendar month show how many months they lag. Unbooked and lagging companies sort first. Each row links to that company's journal.
Staff users in Adviser financial pages are read-only by default: they can open financial pages within their assigned company scope, view ledgers and documents, print vouchers, and export reports/Excel data. Chart-of-Accounts create/edit/delete can be enabled for a staff account through the button-level permissions `financialAccounts.create`, `financialAccounts.edit`, and `financialAccounts.delete` (with company access/financial-manager scope still enforced); other financial mutations remain blocked unless their routes explicitly support the matching button-level permission.

### 6. Invoices (`/admin/invoices`)
Service invoicing for TCSP professional fees.
- List with search, status filter
- Invoice statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Create invoices for either a linked client company or an approved personal KYC identity; billing fields are auto-filled from the selected customer and can be manually adjusted; line items support description, quantity, unit price, and an optional per-line discount entered either as a percentage or a fixed amount; each line can also link to a TCSP service-price entry to auto-fill description and unit price while still allowing later manual edits that only affect the invoice snapshot; the form remains no-tax (`0%`) and the editor no longer shows a separate tax line under the subtotal/total summary; each invoice line is one table row: line number (1, 2, 3), TCSP service price, unit price, discount type, discount value, and amount. The printed description sits under the TCSP price. Selecting a price writes the amount into the unit price field only; the dropdown shows jurisdiction, customer level, and service content, not the amount. It also fills the description from the price-list notes (or the service content when notes are empty) and the staff member can still edit it; the edit only changes the invoice snapshot. The new-invoice form includes due-date quick options for `现结`, `月结`, `月结30天`, and `月结60天`. `现结` sets the due date to the issue date; the month-end options calculate from that same date (or today if the issue date is empty)
- Draft and sent invoices start read-only. Staff with `invoices.edit` click **修改**, then change billing fields, dates, notes, and line items, then save. Paid and cancelled invoices stay read-only. Status changes (sent, paid, cancel) also require `invoices.edit`. Line columns match the new-invoice form (line number, TCSP service price plus description, unit price, discount type, discount value, amount) and do not show quantity
- Generate and download PDF; columns match the line editor (No., TCSP service price, unit price, discount type, discount value, amount) with the total only — no quantity, subtotal, or tax line. The TCSP service price cell prints the linked service (jurisdiction / customer level / service content) and, when it differs, the saved description. Text uses a Songti/Ming serif (AR PL UMing), including Chinese. Empty discounts are left blank, not shown as a dash. The PDF uses global 6AM Advisory sender contact details in the header and Bank of China (Hong Kong) / FPS payment instructions in the footer
- Upload historical invoice PDFs from the invoice list via **添加历史发票**; admins can add/edit a text note for each uploaded historical PDF and the note is shown directly in the historical-file list; uploaded historical files are stored as downloadable archives and do not create or modify formal invoice records, numbering, totals, or statuses
- Link invoices to client companies or approved individual KYC records

### 6b. Projects (`/admin/projects`)
Service engagements for client companies or approved individual KYC persons.
- Each project gets an auto-generated project number `PRJ-YYYY-NNNNN` (shown in list and detail; searchable). The project list is sorted by project number, newest first. The project number is not a link; a **查看** button on the right opens the detail page
- The project list shows **开票状态** and **收款状态** rolled up from linked invoices (cancelled invoices ignored). 开票: 未开票 (none or drafts only) / 部分开票 (mix of drafts and issued) / 已开票 (every active invoice is sent or paid). 收款: 未收款 / 部分收款 / 已收款, counted only on issued invoices (`SENT` / `PAID`)
- Customer type: company or natural person (`INDIVIDUAL`, approved KYC only)
- Period is optional: annual/custom date range, or one-time work with no start/end (no auto-expire / renew). A one-year period ends the day before the anniversary (2026-05-18 → 2027-05-17). On the new-project form and the project detail page, picking or changing the start date sets the end date that way. The end date can still be edited manually
- Project types: company incorporation, corporate secretarial, accounting, other
- Statuses: `ACTIVE` → `COMPLETED` / `EXPIRED` / `CANCELLED` / `RENEWED`; overdue period projects auto-mark as `EXPIRED` when listed or opened
- Register work items (tasks) when needed and mark them done when finished
- Link invoices for the same customer; each linked row has an **Open invoice** button and a **paid checkbox** (勾选 = `PAID` 已收款, 取消 = `SENT` 未收款; draft/cancelled invoices cannot be toggled here)
- Staff who can open invoices can click **开新发票** from the project invoice section (and from the link dialog). It opens `/admin/invoices/new` with the project customer prefilled; after the invoice is created it is automatically linked back to this project
- When a period ends, create the next-period project (start = the day after the prior end, end = the day before that start date's anniversary) with a new project number; prior project becomes `RENEWED`; one-time projects cannot be renewed
- Access and actions: `projects`, `projects.create`, `projects.edit`, `projects.delete`

### 6c. Contracts (`/admin/contracts`)
Independent Adviser contract management, not linked to client companies.
- Upload and download contract files (PDF, Word, JPG, PNG, WEBP; max 10 MB; Chinese file names are preserved for download)
- Contract metadata includes contract name, start date, end date, and notes; metadata can be edited after upload
- Access and actions are controlled by Role Management permissions `contracts`, `contracts.create`, `contracts.edit`, and `contracts.delete`

### 6c2. Form downloads (`/admin/forms`)
Shared Adviser form library, not linked to client companies.
- Staff upload blank forms (PDF, Word, Excel; max 15 MB) with a name and optional notes, then download them from the list
- Name and notes can be edited after upload; delete removes the file
- Access and actions are controlled by Role Management permissions `forms`, `forms.create`, `forms.edit`, and `forms.delete`

### 6d. TCSP Service Pricing (`/admin/tcsp-pricing`)
Central price-list management for TCSP service quotes.
- Maintains service pricing by jurisdiction (`HK`, `BVI`, `CAYMAN`, `MARSHALL`), customer level (`经销客户` / `VIP顾客`), free-text service content, currency, amount, and notes
- Service content is a single admin-entered description field, so admins can cover any current or future TCSP service without selecting a preset category or item
- The same jurisdiction + customer level + service content combination is unique to prevent duplicate quote rows
- Access and actions are controlled by Role Management permissions `tcspPricing`, `tcspPricing.create`, `tcspPricing.edit`, and `tcspPricing.delete`

### 6e. Work tasks (`/admin/tasks`)
Independent secretarial task files. Not stored in company documents, not produced by company docgen, and not the shared form-download library.
- Hub lists task categories. The first category is **成员/股东的变更**, with one task: **股份转让**
- Share transfer selects the company from company management, and the transferor and transferee from natural-person (KYC) management. A natural person's name is prefilled surname first; a company name is left as registered. Names and addresses can still be typed by hand on the task only. It does not write those records back
- Generating the task fills the Word templates (instrument of transfer, bought and sold note, directors' resolution, new share certificate, and optional IRD confirmations) and stores the downloads on the task. Values filled into the instrument of transfer and bought and sold note are underlined. The IRD confirmation and the transferor's no-SPA confirmation print the company's company number as BRN No. Staff download them and submit the stamp-duty pack to the Inland Revenue Department. A normal share transfer has no Companies Registry form
- Submit does **not** append a share transaction, change member holdings, or update the register of members
- Accounts, audit report, and articles are still collected from the client; they are not generated
- Access: `workTasks`. Generating files requires `workTasks.create`

### 7. Team Management (`/admin/team`)
Staff access control.
- System roles: `SUPER_ADMIN`, `COMPLIANCE`, `STAFF`
- Per-staff platform access flags (Adviser / SFS Diamond)
- Granular admin-menu permission keys (companies, kyc, aml, financial, invoices, projects, contracts, forms, tcspPricing, team, feedback, sfs-customers, sfs-orders, sfs-invoices)
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
- Re-submit while status is `DRAFT` or after `REJECTED` (approved / inactive records are locked)

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
- **Home**: enterprise manufacturer homepage — memorial hero (Forever Love + Eternity Ring) with institutional CTAs; factory proof bar; full-bleed lab editorial; operating standards strip; sharp capability mosaic; B2B partnership block (distributor development, packaging, online system, real-time tracking); production video; six-stage journey; partnership team; partner closing CTA
- **About**: company background, mission, vision
- **Technology**: diamond creation process (CVD growth explained); Step 1 carbon extraction cards (1.1–1.5) and Step 2 CVD growth cards (2.1–2.6) use dedicated lab photos matched to each sub-step
- **Memorial Diamonds**: product showcase with **Our Collection** gallery — loads active Ring / Necklace / Earring / Bracelet designs from SFS diamond specs; category filters; product-grid UI without prices; local image fallbacks when remote photos fail; excludes loose diamond / non-jewellery items
- **Q&A**: FAQ
- **Order** (`/order`): public order placement form; Diamond Specs options are database-driven from SFS Diamond Specs admin, including image-backed Source / Color / Carat / Shape / Ring Design / Necklace Design / Earring Design / Bracelet Design options (source, color, and carat steps show preview thumbnails; carat falls back to generated visual size previews when no image is uploaded); setting types include Ring, Necklace, Earring, Bracelet, and Diamond only; Ring requires a ring size. The client form no longer asks for relationship to the memorial, and no longer offers Other carbon source. Necklace or Bracelet length is filled from diamond specs as soon as that setting is selected when those designs share one length, and updated again from the chosen design. The client can edit it before submit; selecting Earring shows only the Earring Design customer option group; each jewellery setting also offers a fixed **Custom** design option (not a catalog price row) where the client uploads sketch/photo/PDF files (JPG/PNG/WEBP/PDF, max 10 MB, up to 8) plus optional design notes; files use the existing OSS Bucket and unsubmitted uploads are automatically removed after 7 days; Custom jewellery is excluded from the live estimate (diamond portion still estimates) and awaits staff quotation; **option prices and estimated order totals are shown live** for catalog designs (global catalog, or personalised when the logged-in client has price overrides); anonymous submissions create an order and SFS customer record, while logged-in SFS clients also get the order linked to their account
- **Order Success** (`/order/success`): confirmation page
- Source Material step also collects optional **Mailing Company** and **Mail Tracking Code** under Mailing Package; both are stored on the order and shown on the admin order detail and production report
- **Dashboard** (authenticated): client's orders with milestone progress; **online self-registered accounts start Pending and cannot view order details until staff Approve** in SFS Customers; each order includes an editable **Your Internal Order Code** field for the customer's own reference numbering (updatable at any time on My Orders and order detail); when a staff quotation is set, the list shows the quoted HKD amount
- **Dashboard Detail** (`/dashboard/[id]`): specific order status and phase timeline; requires approved account; internal order code field alongside order details; shows staff **Quoted amount** + quote notes when present
- Authenticated SFS Dashboard pages and the order edit flow include an English AI request chat widget for submitting feature requests or improvement ideas

### SFS Customers Admin (`/admin/sfs-customers`)
Customer registry for SFS Diamond.
- Lists SFS platform registered client accounts, manually created customer profiles, and historical order-only contact records
- Shows customer name, email, phone, mailing address, source type, **權限** dropdown (待審批 / 已批准 / 已拒絕 for registered logins — staff change status here), order count, and latest order link/status
- Staff change account **權限** directly in the customer list; only 已批准 accounts can open dashboard/order details
- Create manual SFS customer records without creating or binding an official platform login account/email
- Edit SFS customer profile fields (name, email, phone, mailing address, notes); order-only contacts are converted to bound customer profiles when edited
- Staff can multi-select customer rows and **Merge into primary**: orders, contracts, and client price overrides move to the kept profile; source registered logins are deactivated and emptied source profiles are removed
- Delete customer profiles that have no order history; customers linked to any order cannot be deleted; deletion requires a confirmation dialog
- Each bound customer profile includes a cooperation-contract attachments module on the edit dialog: upload, view, download, and delete partnership agreement files (PDF, Word, JPG, PNG, WEBP; max 10 MB)
- Customer-specific prices are managed under **价格管理** (`/admin/sfs-factory`), not on the customer edit dialog
- Logged-in SFS clients see **live option prices and estimated totals** while placing an order (`/sfsdiamond/order`); guests see global catalog prices; personalised lists apply when the account has a bound SfsCustomer with overrides

### SFS Diamond Specs Admin (`/admin/sfs-diamond-specs`)
Customer-facing order option management for SFS Diamond.
- Page opens with the **Source** category filter selected by default; admins can switch to All or any other category tab
- Maintains active/inactive options for Source, Color, Carat, Shape, Setting Type, Ring Design, Necklace Design, Earring Design, Bracelet Design, and Metal
- Necklace Design and Bracelet Design options store a default **length**. Selecting Bracelet or Necklace on the client order fills that length when the designs share one; selecting a design uses that design's length. The client can still edit it before submitting
- Source, Color, Carat, Shape, Ring Design, Necklace Design, Earring Design, and Bracelet Design options can store preview image URLs; admin can upload images to OSS/local storage or paste an existing URL
- Active options are shown on `/sfsdiamond/order`; submitted orders keep saved text values
- Spec options no longer edit prices here — global and per-customer prices are managed under **价格管理**

### SFS Price Management (`/admin/sfs-factory`)
Pricing for SFS Diamond products (menu: 价格管理).
- Two tabs: **标准价格** and **客户价格**, both grouped as **基础价格 (Carat)** → **Add-on (Source / Color / Shape)** → **首饰价格 (Designs, then Metal)**
- Add-on amounts display as `+HK$…` / `−HK$…`; base and design amounts as `HK$…`; Metal as percent (`10` ⇒ `+10%`) on the selected jewellery design
- **Multi-diamond discount tiers** (standard + optional per-customer override): by order diamond count, discount applies only to the diamond portion (`carat + source + color + shape`); jewellery is never discounted; empty customer tiers = use standard
- Price meaning by category: CARAT = diamond base price; SOURCE/COLOR/SHAPE = additive HKD adjustment (may be negative); each design = jewellery price; METAL = percent add-on on that design; unset price counts as 0
- Diamond pricing model (per diamond): `(caratBase + sourceAdj + colorAdj + shapeAdj)` for the diamond portion; jewellery = `designPrice × (1 + metalPct/100)` (metal contributes 0 when there is no design / Diamond only); order `subtotal = diamondNet + jewelleryTotal` after multi-diamond discount on diamondGross; per-customer overrides replace matching globals
- Blank client override = use global standard price; saved overrides apply to quoting, invoicing, and the client order form
- Live estimated totals (including multi-diamond discount breakdown when applicable) remain on the customer order wizard (`/sfsdiamond/order`), not on this admin page

### SFS Orders Admin (`/admin/sfs-orders`)
Order lifecycle management for memorial diamond commissions.
- List with search (client name / email / sample code) and **status filter** chips (`All` / `PENDING` / `QUOTED` / `CONFIRMED` / `COMPLETED` / `CANCELLED`); columns: status, sample code, memorial name, client, source type, colour, diamond count, creation date; orders with a Custom jewellery design show a **Custom** badge
- Staff with permission `sfsOrders.delete` (角色管理 → 订单 → 删除) can permanently delete orders from the list or order detail; deletion removes production steps/images and custom design uploads and unlinks (does not delete) related invoices; custom design files follow the existing anonymous OSS read rule; Super Admin always has this permission
- Order detail shows the customer's self-entered internal order reference (read-only) when set
- Order statuses: `PENDING` → `QUOTED` → `CONFIRMED` → `COMPLETED` / `CANCELLED`
- Custom design panel: view client-uploaded design files (images/PDF) and design notes per diamond; staff enter **Quoted amount (HKD)** and optional **Quote notes** (both visible to the client), then set status to `QUOTED`
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
- Order steps: create / update / complete sub-tasks within Chemical Transformation (**12**), CVD Growth (**5** — Day-21 check removed; ends with Check Finished Diamond Status and Labeling), Crafting (**4**), and Jewelry Setting (**2**); each order has a per-order step plan (defaults to the standard predefined steps); staff with independent permission `sfsOrders.manageSteps` (角色管理 → 订单 → 管理步骤) can insert custom steps between any positions, remove predefined or custom steps, and reset a phase to defaults; completing a step links it via `planStepId`
- Chemical Transformation phase defaults begin with **Package Received**, then **Package arrived production site**, Check Sample & Labeling, and the remaining NL00001 workflow steps (including a weight-capture step)
- CVD Growth phase defaults: Gas bottle to connect with CVD machine → Diamond Seed Status → Diamond Growth in CVD Machine → Diamond Grown → Check Finished Diamond Status and Labeling (per-diamond images)
- Completed step attachments: uploaded images display at 224×224px (4× the previous thumbnail size) for easier admin review
- Production step images uploaded in Chemical Transformation, CVD Growth, Crafting, and Jewelry Setting require manual review (`PENDING` / `APPROVED` / `REJECTED`); staff uploads are auto-marked `PENDING` and await `SUPER_ADMIN` approval; only `APPROVED` images are visible to SFS clients and included in customer production reports; `PENDING` and `REJECTED` images are hidden from clients; approval creates a customer notification

### SFS Invoices Admin (`/admin/sfs-invoices`)
- Invoices linked to SFS orders
- Statuses: `DRAFT` → `SENT` → `PAID` / `CANCELLED`
- Auto-generated invoice numbers: 8-digit pure numeric format `YY######` (e.g. `26000001`, `26000002`), sequential within each calendar year; shown in the list table column and in the page header (top-right) on new and detail pages
- Create from order; edit DRAFT; generate and download PDF
- When creating an invoice from an order, each diamond line item's **unit price is auto-suggested by the pricing engine** (diamond carat/color/shape/source base with multi-diamond diamond-portion discount allocated per line + design × (1 + metal%) + the order customer's overrides); suggested prices remain fully editable before saving
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
