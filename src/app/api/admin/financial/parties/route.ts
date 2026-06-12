import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { partySchema } from '@/lib/financial/schemas'
import { serializeParty } from '@/lib/financial/subledger-serializers'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId)
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

  const guard = await guardFinancialCompany(parsed.data.companyId)
  if (guard.error) return guard.error

  try {
    const party = await prisma.party.create({
      data: {
        companyId: parsed.data.companyId,
        code: parsed.data.code,
        name: parsed.data.name,
        nameZh: parsed.data.nameZh ?? null,
        isCustomer: parsed.data.isCustomer,
        isSupplier: parsed.data.isSupplier,
        isEmployee: parsed.data.isEmployee,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        address: parsed.data.address ?? null,
        taxNumber: parsed.data.taxNumber ?? null,
        currency: parsed.data.currency,
        paymentTermsDays: parsed.data.paymentTermsDays,
        creditLimit: parsed.data.creditLimit ?? null,
        arAccountId: parsed.data.arAccountId ?? null,
        apAccountId: parsed.data.apAccountId ?? null,
        notes: parsed.data.notes,
        isActive: parsed.data.isActive,
      },
    })
    await logAudit(guard.session.user.id, 'CREATE', 'Party', party.id, null, party)
    return NextResponse.json({ party: serializeParty(party), toast: '往来单位已创建。' }, { status: 201 })
  } catch (err) {
    return handleFinancialError(err)
  }
}
