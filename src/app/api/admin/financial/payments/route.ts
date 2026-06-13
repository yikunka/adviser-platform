import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { createPaymentWithAllocations, finPaymentInclude } from '@/lib/financial/fin-payments'
import { paymentCreateSchema } from '@/lib/financial/schemas'
import { serializePayment } from '@/lib/financial/subledger-serializers'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId, { requireManager: true })
  if (guard.error) return guard.error

  const direction = req.nextUrl.searchParams.get('direction')
  const partyId = req.nextUrl.searchParams.get('partyId')
  const search = req.nextUrl.searchParams.get('search')?.trim()

  const where: Prisma.FinPaymentWhereInput = {
    companyId: companyId!,
    ...(direction === 'RECEIPT' || direction === 'PAYMENT' ? { direction } : {}),
    ...(partyId ? { partyId } : {}),
    ...(search
      ? {
          OR: [
            { paymentNo: { contains: search, mode: 'insensitive' } },
            { reference: { contains: search, mode: 'insensitive' } },
            { party: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const payments = await prisma.finPayment.findMany({
    where,
    include: finPaymentInclude,
    orderBy: [{ paymentDate: 'desc' }, { paymentNo: 'desc' }],
  })
  return NextResponse.json({ payments: payments.map(serializePayment) })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = paymentCreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查收付款表单。')
  }

  const guard = await guardFinancialCompany(parsed.data.companyId, { requireManager: true })
  if (guard.error) return guard.error

  try {
    const payment = await createPaymentWithAllocations({
      ...parsed.data,
      createdById: guard.session.user.id,
    })
    await logAudit(guard.session.user.id, 'CREATE', 'FinPayment', payment.id, null, {
      paymentNo: payment.paymentNo,
      direction: payment.direction,
    })
    const label = payment.direction === 'RECEIPT' ? '收款' : '付款'
    return NextResponse.json(
      { payment: serializePayment(payment), toast: `${label} ${payment.paymentNo} 已登记并自动过账。` },
      { status: 201 },
    )
  } catch (err) {
    return handleFinancialError(err)
  }
}
