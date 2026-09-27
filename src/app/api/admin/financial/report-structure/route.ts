import { NextRequest, NextResponse } from 'next/server'
import type { FinancialReportSection } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import {
  apiError,
  guardFinancialCompany,
  guardFinancialMutationCompany,
  handleFinancialError,
} from '@/lib/financial/api-guard'
import {
  BS_REPORT_SECTIONS,
  PL_REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
  suggestReportSectionMappings,
} from '@/lib/financial/report-structure'
import { financialReportStructureUpsertSchema } from '@/lib/financial/schemas'

function sectionsForStatement(statement: 'INCOME_STATEMENT' | 'BALANCE_SHEET') {
  return statement === 'INCOME_STATEMENT' ? PL_REPORT_SECTIONS : BS_REPORT_SECTIONS
}

/** GET ?companyId=&statement=INCOME_STATEMENT|BALANCE_SHEET */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const statementParam = req.nextUrl.searchParams.get('statement') ?? 'INCOME_STATEMENT'
  const statement = statementParam === 'BALANCE_SHEET' ? 'BALANCE_SHEET' : 'INCOME_STATEMENT'
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const sections = sectionsForStatement(statement)
  const [mappings, accounts] = await Promise.all([
    prisma.financialReportSectionMapping.findMany({
      where: {
        companyId: companyId!,
        section: { in: [...sections] },
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true, level: true, parentId: true } },
      },
      orderBy: [{ section: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.finAccount.findMany({
      where: { companyId: companyId! },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        level: true,
        parentId: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    }),
  ])

  const bySection = Object.fromEntries(
    sections.map(section => [
      section,
      {
        section,
        label: REPORT_SECTION_LABELS[section],
        accounts: mappings
          .filter(row => row.section === section)
          .map(row => row.account),
      },
    ]),
  ) as Record<FinancialReportSection, {
    section: FinancialReportSection
    label: string
    accounts: Array<{ id: string; code: string; name: string; type: string; level: number; parentId: string | null }>
  }>

  return NextResponse.json({
    statement,
    configured: mappings.length > 0,
    sections: bySection,
    accounts,
  })
}

/** PUT — replace all mappings for one statement (profit & loss or balance sheet). */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = financialReportStructureUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查报表结构输入。')
  }

  const guard = await guardFinancialMutationCompany(parsed.data.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const allowedSections = new Set<string>(sectionsForStatement(parsed.data.statement))
  for (const row of parsed.data.mappings) {
    if (!allowedSections.has(row.section)) {
      return apiError(`科目分类 ${row.section} 不属于${parsed.data.statement === 'INCOME_STATEMENT' ? '利润表' : '资产负债表'}。`)
    }
  }

  const accountIds = [...new Set(parsed.data.mappings.map(row => row.accountId))]
  if (accountIds.length > 0) {
    const accounts = await prisma.finAccount.findMany({
      where: { companyId: parsed.data.companyId, id: { in: accountIds } },
      select: { id: true, code: true, name: true, type: true },
    })
    if (accounts.length !== accountIds.length) {
      return apiError('部分科目不属于该公司。')
    }
    if (parsed.data.statement === 'INCOME_STATEMENT') {
      const invalid = accounts.filter(account => (
        account.type !== 'REVENUE' && account.type !== 'EXPENSE' && account.type !== 'CGS'
      ))
      if (invalid.length > 0) {
        const sample = invalid.slice(0, 3).map(a => `${a.code} ${a.name}`).join('、')
        return apiError(`利润表结构只能选择损益类科目（收入/成本/费用），不能加入资产负债表科目：${sample}`)
      }
    }
  }

  const sections = [...allowedSections] as FinancialReportSection[]

  try {
    await prisma.$transaction(async tx => {
      await tx.financialReportSectionMapping.deleteMany({
        where: {
          companyId: parsed.data.companyId,
          section: { in: sections },
        },
      })
      if (parsed.data.mappings.length > 0) {
        await tx.financialReportSectionMapping.createMany({
          data: parsed.data.mappings.map(row => ({
            companyId: parsed.data.companyId,
            section: row.section,
            accountId: row.accountId,
          })),
          skipDuplicates: true,
        })
      }
    })

    await logAudit(
      guard.session.user.id,
      'UPDATE',
      'FinancialReportSectionMapping',
      parsed.data.companyId,
      null,
      {
        statement: parsed.data.statement,
        count: parsed.data.mappings.length,
      },
    )

    return NextResponse.json({
      toast: parsed.data.mappings.length > 0
        ? '报表结构已保存。'
        : '已清空自定义结构，报表将恢复按科目类型/编码推断。',
    })
  } catch (err) {
    return handleFinancialError(err)
  }
}

/** POST ?companyId=&statement= — seed suggested mappings from heuristics. */
export async function POST(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const statementParam = req.nextUrl.searchParams.get('statement') ?? 'INCOME_STATEMENT'
  const statement = statementParam === 'BALANCE_SHEET' ? 'BALANCE_SHEET' : 'INCOME_STATEMENT'
  const guard = await guardFinancialMutationCompany(companyId, { requireManager: true })
  if (guard.error) return guard.error

  const accounts = await prisma.finAccount.findMany({
    where: { companyId: companyId! },
    select: {
      id: true,
      companyId: true,
      parentId: true,
      code: true,
      name: true,
      type: true,
      level: true,
    },
  })

  const allowed = new Set<string>(sectionsForStatement(statement))
  const suggestions = suggestReportSectionMappings(
    accounts.map(account => ({
      ...account,
      companyId: account.companyId,
    })),
  ).filter(row => allowed.has(row.section))

  try {
    await prisma.$transaction(async tx => {
      await tx.financialReportSectionMapping.deleteMany({
        where: {
          companyId: companyId!,
          section: { in: [...allowed] as FinancialReportSection[] },
        },
      })
      if (suggestions.length > 0) {
        await tx.financialReportSectionMapping.createMany({
          data: suggestions.map(row => ({
            companyId: companyId!,
            section: row.section,
            accountId: row.accountId,
          })),
          skipDuplicates: true,
        })
      }
    })

    await logAudit(guard.session.user.id, 'UPDATE', 'FinancialReportSectionMapping', companyId!, null, {
      statement,
      action: 'seed',
      count: suggestions.length,
    })

    return NextResponse.json({
      toast: `已按当前科目推断写入 ${suggestions.length} 条建议映射，请核对后保存调整。`,
      count: suggestions.length,
    })
  } catch (err) {
    return handleFinancialError(err)
  }
}
