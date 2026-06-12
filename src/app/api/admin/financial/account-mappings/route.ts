import { NextRequest, NextResponse } from 'next/server'
import type { AccountMappingKey } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { DEFAULT_MAPPING_CODES, MAPPING_KEY_LABELS } from '@/lib/financial/account-mappings'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { accountMappingUpsertSchema } from '@/lib/financial/schemas'

/** 返回每个映射键的当前配置（显式配置 / 默认回退 / 缺失）。 */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const [mappings, accounts] = await Promise.all([
    prisma.accountMapping.findMany({
      where: { companyId: companyId! },
      include: { account: { select: { id: true, code: true, name: true } } },
    }),
    prisma.finAccount.findMany({
      where: { companyId: companyId!, code: { in: Object.values(DEFAULT_MAPPING_CODES) } },
      select: { id: true, code: true, name: true },
    }),
  ])

  const mappingByKey = new Map(mappings.map(mapping => [mapping.key, mapping]))
  const accountByCode = new Map(accounts.map(account => [account.code, account]))

  const rows = (Object.keys(MAPPING_KEY_LABELS) as AccountMappingKey[]).map(key => {
    const explicit = mappingByKey.get(key)
    const fallback = accountByCode.get(DEFAULT_MAPPING_CODES[key])
    return {
      key,
      label: MAPPING_KEY_LABELS[key],
      defaultCode: DEFAULT_MAPPING_CODES[key],
      account: explicit?.account ?? fallback ?? null,
      source: explicit ? 'EXPLICIT' : fallback ? 'DEFAULT' : 'MISSING',
    }
  })

  return NextResponse.json({ mappings: rows })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = accountMappingUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查科目映射输入。')
  }

  const guard = await guardFinancialCompany(parsed.data.companyId)
  if (guard.error) return guard.error

  const accountIds = [...new Set(parsed.data.mappings.map(mapping => mapping.accountId))]
  const ownedCount = await prisma.finAccount.count({
    where: { companyId: parsed.data.companyId, id: { in: accountIds } },
  })
  if (ownedCount !== accountIds.length) {
    return apiError('部分科目不属于该公司。')
  }

  try {
    await prisma.$transaction(
      parsed.data.mappings.map(mapping =>
        prisma.accountMapping.upsert({
          where: { companyId_key: { companyId: parsed.data.companyId, key: mapping.key } },
          create: { companyId: parsed.data.companyId, key: mapping.key, accountId: mapping.accountId },
          update: { accountId: mapping.accountId },
        }),
      ),
    )
    await logAudit(guard.session.user.id, 'UPDATE', 'AccountMapping', parsed.data.companyId, null, parsed.data.mappings)
    return NextResponse.json({ toast: '科目映射已保存。' })
  } catch (err) {
    return handleFinancialError(err)
  }
}
