import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany } from '@/lib/financial/api-guard'
import { buildDimensionPlReport, type DimensionPlLineInput } from '@/lib/financial/dimension-pl'
import { isDimensionType } from '@/lib/financial/dimensions'

/**
 * 维度损益表：?companyId=&type=cost-center|project&period=YYYY-MM(可选)
 * 汇总已过账凭证的损益类分录，按维度归集。
 */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const type = req.nextUrl.searchParams.get('type')
  if (!isDimensionType(type)) return apiError('维度类型无效。')
  const period = req.nextUrl.searchParams.get('period')
  if (period && !/^\d{4}-\d{2}$/.test(period)) return apiError('期间格式须为 YYYY-MM。')

  const where: Prisma.JournalLineWhereInput = {
    entry: { companyId: companyId!, status: 'POSTED', ...(period ? { period } : {}) },
    account: { type: { in: ['REVENUE', 'EXPENSE', 'CGS'] } },
  }

  const lines = await prisma.journalLine.findMany({
    where,
    select: {
      debit: true,
      credit: true,
      costCenterId: true,
      projectId: true,
      account: { select: { type: true, code: true } },
      costCenter: { select: { id: true, code: true, name: true } },
      project: { select: { id: true, code: true, name: true } },
    },
  })

  const inputs: DimensionPlLineInput[] = lines.map(line => {
    const dim = type === 'cost-center' ? line.costCenter : line.project
    return {
      dimensionId: dim?.id ?? null,
      dimensionCode: dim?.code ?? '',
      dimensionName: dim?.name ?? '',
      accountType: line.account.type,
      accountCode: line.account.code,
      debit: Number(line.debit),
      credit: Number(line.credit),
    }
  })

  return NextResponse.json({ report: buildDimensionPlReport(inputs), type, period: period ?? null })
}
