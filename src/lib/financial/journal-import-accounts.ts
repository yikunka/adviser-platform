import { Prisma, type AccountType } from '@prisma/client'
import type { prisma } from '@/lib/db/prisma'
import { DEFAULT_CHART_OF_ACCOUNTS } from '@/lib/financial/default-chart-of-accounts'

type FinAccountClient = Pick<typeof prisma, 'finAccount'>

type AccountRecord = {
  id: string
  code: string
  name: string
  type: AccountType
  parentId: string | null
  level: number
  sortOrder: number
}

type MutableAccountRecord = Pick<AccountRecord, 'id' | 'code' | 'name'>

type ImportRootPlan = {
  rootCode: string
  type: AccountType
}

type NameMatcher = string | RegExp

const IMPORT_ACCOUNT_RULES: ReadonlyArray<{
  rootCode: string
  type: AccountType
  matchers: NameMatcher[]
}> = [
  {
    rootCode: '01',
    type: 'ASSET',
    matchers: [
      /cash/i,
      /bank/i,
      /deposit/i,
      /petty/i,
      /prepayment/i,
      /advance/i,
      /fixed asset/i,
      /equipment/i,
      /inventory/i,
      /stock/i,
      /cash equivalents?/i,
      '现金',
      '银行',
      '存款',
      '押金',
      '预付',
      '预支',
      '固定资产',
      '设备',
      '存货',
      '库存',
    ],
  },
  {
    rootCode: '02',
    type: 'ASSET',
    matchers: [
      /receivable/i,
      /\bar\b/i,
      /refund/i,
      '应收',
      '其他应收',
      '应收账款',
      '應收',
      '退款',
    ],
  },
  {
    rootCode: '03',
    type: 'LIABILITY',
    matchers: [
      /payable/i,
      /\bap\b/i,
      /accrued/i,
      /loan/i,
      /tax payable/i,
      /vat payable/i,
      '应付',
      '應付',
      '应交税',
      '應交稅',
      '借款',
      '贷款',
      '貸款',
      '预收',
      '預收',
    ],
  },
  {
    rootCode: '04',
    type: 'EQUITY',
    matchers: [
      /equity/i,
      /capital/i,
      /dividend/i,
      /retained/i,
      '权益',
      '權益',
      '资本',
      '資本',
      '留存收益',
      '未分配利润',
      '未分配利潤',
      '股本',
    ],
  },
  {
    rootCode: '05',
    type: 'REVENUE',
    matchers: [
      /revenue/i,
      /income/i,
      /sales/i,
      /turnover/i,
      /commission income/i,
      /interest income/i,
      /other income/i,
      '收入',
      '收益',
      '营业收入',
      '營業收入',
      '销售收入',
      '銷售收入',
      '佣金收入',
      '利息收入',
      '其他收入',
    ],
  },
  {
    rootCode: '06',
    type: 'CGS',
    matchers: [
      /cost of sales/i,
      /\bcogs\b/i,
      /purchase cost/i,
      '成本',
      '销售成本',
      '銷售成本',
      '采购成本',
      '採購成本',
    ],
  },
  {
    rootCode: '08',
    type: 'EXPENSE',
    matchers: [
      /selling/i,
      /marketing/i,
      /promotion/i,
      '销售费用',
      '銷售費用',
      '市场',
      '市場',
      '推广',
      '推廣',
      '广告',
      '廣告',
    ],
  },
  {
    rootCode: '09',
    type: 'EXPENSE',
    matchers: [
      /finance/i,
      /bank charge/i,
      /bank fee/i,
      /interest expense/i,
      /exchange loss/i,
      '财务费用',
      '財務費用',
      '银行手续费',
      '銀行手續費',
      '利息支出',
      '汇兑',
      '匯兌',
    ],
  },
  {
    rootCode: '07',
    type: 'EXPENSE',
    matchers: [
      /expense/i,
      /salary/i,
      /wage/i,
      /rent/i,
      /utilities/i,
      /office/i,
      /professional fee/i,
      /tax expense/i,
      /insurance/i,
      /trav(?:el|elling)/i,
      '费用',
      '費用',
      '工资',
      '工資',
      '薪金',
      '租金',
      '水电',
      '水電',
      '办公',
      '辦公',
      '专业服务费',
      '專業服務費',
      '差旅',
      '保险',
      '保險',
    ],
  },
]

export function nextImportedAccountCode(parentCode: string, existingCodes: Iterable<string>) {
  const used = new Set([...existingCodes].map(code => code.toLowerCase()))
  const base = parentCode.trim()

  for (let index = 1; index <= 999; index += 1) {
    const candidate = `${base}.${String(index).padStart(3, '0')}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }

  for (let index = 1000; index <= 9999; index += 1) {
    const candidate = `${base}.${index}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }

  return `${base}.${Date.now()}`
}

export function nextImportedTopLevelCode(existingCodes: Iterable<string>) {
  const used = new Set([...existingCodes].map(code => code.toLowerCase()))
  for (let index = 1; index <= 9999; index += 1) {
    const candidate = `IMP-${String(index).padStart(4, '0')}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `IMP-${Date.now()}`
}

function matcherMatches(name: string, matcher: NameMatcher) {
  return typeof matcher === 'string'
    ? name.includes(matcher.toLowerCase())
    : matcher.test(name)
}

export function inferImportedAccountRoot(
  accountName: string,
  debit: number,
  credit: number,
): ImportRootPlan {
  const normalized = accountName.trim().toLowerCase()

  for (const rule of IMPORT_ACCOUNT_RULES) {
    if (rule.matchers.some(matcher => matcherMatches(normalized, matcher))) {
      return { rootCode: rule.rootCode, type: rule.type }
    }
  }

  return debit > 0 && credit <= 0
    ? { rootCode: '07', type: 'EXPENSE' }
    : { rootCode: '05', type: 'REVENUE' }
}

function fallbackRootType(rootCode: string) {
  return DEFAULT_CHART_OF_ACCOUNTS.find(account => account.code === rootCode)?.type ?? 'EXPENSE'
}

export async function createImportedAccount(
  tx: Prisma.TransactionClient,
  args: {
    companyId: string
    accountName: string
    debit: number
    credit: number
    availableAccounts: AccountRecord[]
  },
) {
  const plan = inferImportedAccountRoot(args.accountName, args.debit, args.credit)
  const parent = args.availableAccounts.find(account => account.code === plan.rootCode)
    ?? args.availableAccounts.find(account => account.level === 1 && account.type === plan.type)
    ?? null

  const siblingSort = parent
    ? await tx.finAccount.aggregate({
        where: { companyId: args.companyId, parentId: parent.id },
        _max: { sortOrder: true },
      })
    : await tx.finAccount.aggregate({
        where: { companyId: args.companyId, parentId: null },
        _max: { sortOrder: true },
      })

  const code = parent
    ? nextImportedAccountCode(parent.code, args.availableAccounts.map(account => account.code))
    : nextImportedTopLevelCode(args.availableAccounts.map(account => account.code))
  const type = parent?.type ?? plan.type ?? fallbackRootType(plan.rootCode)

  const created = await tx.finAccount.create({
    data: {
      companyId: args.companyId,
      code,
      name: args.accountName.trim(),
      type,
      parentId: parent?.id ?? null,
      level: parent ? parent.level + 1 : 1,
      sortOrder: (siblingSort._max.sortOrder ?? 0) + 1,
      isSystem: false,
      notes: 'Journal Excel import auto-created account',
      yearToDateAmount: new Prisma.Decimal(0),
      yearToDateDebit: new Prisma.Decimal(0),
      yearToDateCredit: new Prisma.Decimal(0),
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      parentId: true,
      level: true,
      sortOrder: true,
    },
  })

  return created
}

export type { AccountRecord, MutableAccountRecord, ImportRootPlan, FinAccountClient }
