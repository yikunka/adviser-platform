import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { createPurchaseBill, purchaseBillInclude } from '@/lib/financial/purchase-bills'
import { purchaseBillCreateSchema } from '@/lib/financial/schemas'
import { serializePurchaseBill } from '@/lib/financial/subledger-serializers'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const status = req.nextUrl.searchParams.get('status')
  const partyId = req.nextUrl.searchParams.get('partyId')
  const search = req.nextUrl.searchParams.get('search')?.trim()
  const openOnly = req.nextUrl.searchParams.get('openOnly') === '1'

  const where: Prisma.PurchaseBillWhereInput = {
    companyId: companyId!,
    ...(status ? { status: status as Prisma.PurchaseBillWhereInput['status'] } : {}),
    ...(openOnly ? { status: { in: ['POSTED', 'PARTIALLY_PAID'] } } : {}),
    ...(partyId ? { partyId } : {}),
    ...(search
      ? {
          OR: [
            { billNo: { contains: search, mode: 'insensitive' } },
            { supplierRef: { contains: search, mode: 'insensitive' } },
            { party: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const bills = await prisma.purchaseBill.findMany({
    where,
    include: purchaseBillInclude,
    orderBy: [{ billDate: 'desc' }, { billNo: 'desc' }],
  })
  return NextResponse.json({ bills: bills.map(serializePurchaseBill) })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = purchaseBillCreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查账单表单。')
  }

  const guard = await guardFinancialCompany(parsed.data.companyId)
  if (guard.error) return guard.error

  try {
    const bill = await createPurchaseBill({ ...parsed.data, createdById: guard.session.user.id })
    await logAudit(guard.session.user.id, 'CREATE', 'PurchaseBill', bill.id, null, { billNo: bill.billNo })
    return NextResponse.json(
      { bill: serializePurchaseBill(bill), toast: `账单 ${bill.billNo} 已创建（草稿）。` },
      { status: 201 },
    )
  } catch (err) {
    return handleFinancialError(err)
  }
}
