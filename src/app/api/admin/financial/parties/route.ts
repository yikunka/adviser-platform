import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, guardFinancialMutationCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { ensureDefaultChartOfAccounts } from '@/lib/financial/default-chart-of-accounts'
import { ensurePartyAccount } from '@/lib/financial/party-accounts'
import { nextPartyCode, partyCodePrefixForRole, resolvePartyCodeRole } from '@/lib/financial/party-code'
import { partySchema } from '@/lib/financial/schemas'
import { serializeParty } from '@/lib/financial/subledger-serializers'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId, { requireManager: true })
  if (guard.error) return guard.error

  const role = req.nextUrl.searchParams.get('role') // customer | supplier | employee
  const search = req.nextUrl.searchParams.get('search')?.trim()
  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === '1'

  const where: Prisma.PartyWhereInput = {
    companyId: companyId!,
    ...(role === 'customer' ? { isCustomer: true } : {}),
    ...(role === 'supplier' ? { isSupplier: true } : {}),
    ...(role === 'employee' ? { isEmployee: true } : {}),
    ...(includeInactive ? {} : { isActive: true }),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { nameZh: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const parties = await prisma.party.findMany({ where, orderBy: { code: 'asc' } })
  return NextResponse.json({ parties: parties.map(serializeParty) })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = partySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查往来单位表单。')
  }

  const guard = await guardFinancialMutationCompany(parsed.data.companyId, { requireManager: true })
  if (guard.error) return guard.error

  try {
    await ensureDefaultChartOfAccounts(parsed.data.companyId, prisma)
    const role = resolvePartyCodeRole(parsed.data)
    if (!role) return apiError('至少选择一个角色（客户/供应商/员工）。')

    let party = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        party = await prisma.$transaction(async tx => {
          const prefix = partyCodePrefixForRole(role)
          const existingCodes = await tx.party.findMany({
            where: {
              companyId: parsed.data.companyId,
              code: { startsWith: `${prefix}-` },
            },
            select: { code: true },
          })
          const arAccountId = parsed.data.isCustomer
            ? await ensurePartyAccount(tx, {
                companyId: parsed.data.companyId,
                partyName: parsed.data.name,
                side: 'ar',
                selectedAccountId: parsed.data.arAccountId,
              })
            : null
          const apAccountId = parsed.data.isSupplier
            ? await ensurePartyAccount(tx, {
                companyId: parsed.data.companyId,
                partyName: parsed.data.name,
                side: 'ap',
                selectedAccountId: parsed.data.apAccountId,
              })
            : null

          return tx.party.create({
            data: {
              companyId: parsed.data.companyId,
              code: nextPartyCode(prefix, existingCodes.map(item => item.code)),
              name: parsed.data.name,
              nameZh: parsed.data.nameZh ?? null,
              isCustomer: parsed.data.isCustomer,
              isSupplier: parsed.data.isSupplier,
              isEmployee: parsed.data.isEmployee,
              email: parsed.data.email ?? null,
              phone: parsed.data.phone ?? null,
              address: parsed.data.address ?? null,
              taxNumber: parsed.data.taxNumber ?? null,
              color: parsed.data.color,
              currency: parsed.data.currency,
              paymentTermsDays: parsed.data.paymentTermsDays,
              creditLimit: parsed.data.creditLimit ?? null,
              arAccountId,
              apAccountId,
              notes: parsed.data.notes,
              isActive: parsed.data.isActive,
            },
          })
        })
        break
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError
          && error.code === 'P2002'
          && attempt < 4
        ) {
          continue
        }
        throw error
      }
    }

    if (!party) throw new Error('往来单位自动编号失败。')

    await logAudit(guard.session.user.id, 'CREATE', 'Party', party.id, null, party)
    return NextResponse.json({ party: serializeParty(party), toast: '往来单位已创建。' }, { status: 201 })
  } catch (err) {
    return handleFinancialError(err)
  }
}
