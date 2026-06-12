import type { AccountMappingKey } from '@prisma/client'

type MappingClient = {
  accountMapping: {
    findUnique(args: {
      where: { companyId_key: { companyId: string; key: AccountMappingKey } }
      select: { accountId: true }
    }): Promise<{ accountId: string } | null>
  }
  finAccount: {
    findFirst(args: {
      where: { companyId: string; code: string }
      select: { id: true }
    }): Promise<{ id: string } | null>
  }
}

/** 映射缺省时按默认科目表代码回退（与 DEFAULT_CHART_OF_ACCOUNTS 对齐） */
export const DEFAULT_MAPPING_CODES: Record<AccountMappingKey, string> = {
  AR_CONTROL: '1100', // 应收账款
  AP_CONTROL: '2001', // 应付账款
  SALES_REVENUE: '4001', // 营业收入
  OUTPUT_TAX: '2100', // 应交税费
  INPUT_TAX: '2100', // 应交税费
  BANK_DEFAULT: '1002', // 银行存款
  CASH_DEFAULT: '1001', // 现金
  PURCHASE_EXPENSE_DEFAULT: '6001', // 管理费用
  BANK_FEES: '6001', // 管理费用
  EXCHANGE_GAIN_LOSS: '6001', // 管理费用（预留）
  RETAINED_EARNINGS: '3100', // 留存收益（预留）
}

export const MAPPING_KEY_LABELS: Record<AccountMappingKey, string> = {
  AR_CONTROL: '应收账款控制科目',
  AP_CONTROL: '应付账款控制科目',
  SALES_REVENUE: '默认销售收入科目',
  OUTPUT_TAX: '销项税科目',
  INPUT_TAX: '进项税科目',
  BANK_DEFAULT: '默认银行存款科目',
  CASH_DEFAULT: '默认现金科目',
  PURCHASE_EXPENSE_DEFAULT: '默认采购费用科目',
  BANK_FEES: '银行手续费科目',
  EXCHANGE_GAIN_LOSS: '汇兑损益科目',
  RETAINED_EARNINGS: '留存收益科目',
}

export class MappingNotFoundError extends Error {
  readonly key: AccountMappingKey

  constructor(key: AccountMappingKey) {
    super(`未配置「${MAPPING_KEY_LABELS[key]}」，且默认科目 ${DEFAULT_MAPPING_CODES[key]} 不存在。请先在科目映射中配置。`)
    this.name = 'MappingNotFoundError'
    this.key = key
  }
}

/**
 * 解析过账用科目：先查 AccountMapping 显式配置，
 * 缺省回退到默认科目代码；都没有则抛 MappingNotFoundError。
 */
export async function resolveMappedAccountId(
  client: MappingClient,
  companyId: string,
  key: AccountMappingKey,
): Promise<string> {
  const mapping = await client.accountMapping.findUnique({
    where: { companyId_key: { companyId, key } },
    select: { accountId: true },
  })
  if (mapping) return mapping.accountId

  const fallback = await client.finAccount.findFirst({
    where: { companyId, code: DEFAULT_MAPPING_CODES[key] },
    select: { id: true },
  })
  if (fallback) return fallback.id

  throw new MappingNotFoundError(key)
}
