# 财务模块迭代路线图（剩余部分）

> 本文件记录会计模块尚未完成的工作，供后续继续。
> 已完成部分见各模块代码与 `src/lib/feedback/system-knowledge.md`。
> 最后更新：2026-06-12

## 终极架构原则（贯穿所有阶段，勿违背）

**总账 (GL) 是唯一事实来源；每个业务模块都是子分类账，统一经过账引擎
`createAndPostEntry()`（`src/lib/financial/posting-engine.ts`）生成平衡凭证落到 GL。**
新增模块 = 定义源单据 + 配过账规则（`account-mappings.ts`），不改核心。
作废 = 红冲（`reversePostedEntry`），永不物理删除已过账数据。

分层固定：`schema.prisma` → `lib/financial/<module>.ts`（纯函数+服务，可单测）→
`app/api/admin/financial/<module>/route.ts`（鉴权+序列化）→ `components/admin/financial/`（UI）。
金额一律 `Decimal(18,4)`，禁浮点；过账走 `$transaction`、借贷平衡校验、期间锁校验、写审计日志。

---

## ✅ 已完成（Phase 0–4a）

- **Phase 0 骨架**：统一过账引擎 + 红冲链、共享 `ledger-writer`、会计期间锁 `FiscalPeriod`、
  统一往来单位 `Party`、过账科目映射 `AccountMapping`（带默认科目回退）、并发安全单号 `DocSequence`；
  `JournalLine` 已预埋维度（成本中心/项目/往来）与多币种字段（currency/origDebit/origCredit/exchangeRate）。
- **Phase 1 应收**：销售发票→开票过账→部分/全额收款核销→贷项通知单→AR 账龄→客户对账单。
- **Phase 2 应付**：采购账单→入账→付款核销→借项通知单→AP 账龄→供应商对账单。
- **Phase 3 银行**：银行账户、CSV 流水导入、银行对账（自动匹配 + 手动 + 调节表）。
- **Phase 4a 维度**：成本中心/项目主数据、凭证分录按行打维度、维度损益报表。

---

## ⬜ Phase 4b — 多币种（下一步）

字段已在 Phase 0 埋好（`JournalLine.currency/origDebit/origCredit/exchangeRate`、
`ExchangeRate` 表已存在），本阶段把它们接上。

1. **本位币**：`Company.baseCurrency String @default("HKD")`（新迁移）。
2. **汇率管理**：`ExchangeRate` CRUD API + 设置页 UI（fromCurrency/toCurrency/rate/effectiveDate/isActive）。
3. **换算 helper**：`lib/financial/currency.ts` — 按生效日查汇率、原币→本位币换算。
4. **外币凭证录入**：`JournalEntryForm` 行级加币种 + 原币金额 + 汇率（自动带出生效汇率，本位币借贷自动算）；
   `journalLineSchema`/POST/PATCH 持久化 origDebit/origCredit/currency/exchangeRate；GL 以本位币为准。
5. **期末重估**：对外币货币性科目（银行/AR/AP）按期末汇率重估，差额过 `EXCHANGE_GAIN_LOSS`
   映射科目（已在 `AccountMappingKey` 预留），生成重估凭证（可红冲）。
   新增 `lib/financial/fx-revaluation.ts`（纯函数算差额）+ test + API + UI 触发。

**验收**：外币发票/付款本位币入账正确；期末重估生成的汇兑损益凭证借贷平衡且可红冲。

---

## ⬜ Phase 5 — 固定资产 + 折旧

- 模型：`FixedAsset`（原值/入账日/使用年限/残值/折旧方法/状态）、`DepreciationSchedule`（按期计提明细）、`AssetDisposal`。
- 过账：购置（借固定资产/贷银行或应付）、按月折旧计提（借折旧费用/贷累计折旧，可周期性自动过账）、
  处置（转销原值与累计折旧、确认处置损益）。全部走 `createAndPostEntry`。
- 新增 `AccountMappingKey`：`ACCUM_DEPRECIATION`、`DEPRECIATION_EXPENSE`、`DISPOSAL_GAIN_LOSS`。
- UI：资产登记册、折旧计提（生成本期折旧凭证）、处置。

## ⬜ Phase 6 — 关账/年结 + 报表增强

- 关账流程：期末把 `FiscalPeriod` 置 CLOSED/LOCKED 的管理 UI（引擎校验已就绪）。
- 年结：结转损益类科目到留存收益（`RETAINED_EARNINGS` 映射已预留），生成结转凭证。
- **权益变动表**（HKFRS 必备，目前缺）。
- 报表附注、同比/环比对比期、报表→凭证钻取。

## ⬜ Phase 7 — 预算

- 模型：`Budget` / `BudgetLine`（按科目 × 期间 × 维度）。
- 预算编制 UI、预算 vs 实际差异报表、超预算预警。

## ⬜ Phase 8 — 锦上添花（按价值排序）

1. 费用报销/员工报销单（`Party` 角色=员工，复用 AP 引擎）。
2. 现金流预测 & 财务 KPI 仪表盘。
3. 周期性/模板凭证（基础设施已有，做 UI + 定时触发，`JournalSourceType.RECURRING` 已预留）。
4. 收付款自动核销 / 付款网关对接。
5. 薪资 Payroll。
6. 开放 API / 外部 ERP·税务对接。

---

## ⬜ 地基技术债（不阻塞功能，但迟早要做）

**余额模型重构**：当前 `Ledger` 逐行存 `balance` 快照（`ledger-writer.ts`），
补录/倒插日期的凭证会使后续行余额失真。终极方案：`AccountBalance` 期初快照 + 期内按需聚合，
`Ledger.balance` 降级为派生值。改动集中在 `ledger-writer.ts` 与报表/总账读取处。

---

## 本地迁移工作流（重要）

本地 PostgreSQL 用户**无 CREATE DATABASE 权限**，`prisma migrate dev` 会失败（P3014 影子库）。正确流程：

```bash
# 1. 生成 SQL（--from-config-datasource 读当前库实际状态；Prisma 7 用 --to-schema）
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
  > prisma/migrations/<timestamp>_<name>/migration.sql
# 2. 应用（不需影子库）
npx prisma migrate deploy
# 3. 重新生成 client
npx prisma generate
```

> Bash 命令受 RTK hook 重写，若报 `[rtk: No such file or directory]` 用 `rtk proxy <cmd>` 绕过。
> `prisma migrate deploy` 写库会被安全分类器拦截，需用户授权。
