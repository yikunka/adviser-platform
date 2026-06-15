import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialMutationCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { validatePartyAccount } from '@/lib/financial/party-accounts'
import { partyUpdateSchema } from '@/lib/financial/schemas'
import { serializeParty } from '@/lib/financial/subledger-serializers'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.party.findUnique({ where: { id } })
  if (!before) return apiError('往来单位不存在。', 404)

  const guard = await guardFinancialMutationCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const parsed = partyUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查往来单位表单。')
  }

  try {
    if (parsed.data.arAccountId) {
      const account = await validatePartyAccount(prisma, before.companyId, parsed.data.arAccountId)
      if (!account) return apiError('关联应收科目不存在或不属于该公司。')
    }
    if (parsed.data.apAccountId) {
      const account = await validatePartyAccount(prisma, before.companyId, parsed.data.apAccountId)
      if (!account) return apiError('关联应付科目不存在或不属于该公司。')
    }

    const { code, ...rest } = parsed.data
    void code
    const data: Prisma.PartyUncheckedUpdateInput = { ...rest }
    if (parsed.data.isCustomer === false) data.arAccountId = null
    if (parsed.data.isSupplier === false) data.apAccountId = null
    const party = await prisma.party.update({ where: { id }, data })
    await logAudit(guard.session.user.id, 'UPDATE', 'Party', id, before, party)
    return NextResponse.json({ party: serializeParty(party), toast: '往来单位已更新。' })
  } catch (err) {
    return handleFinancialError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.party.findUnique({ where: { id } })
  if (!before) return apiError('往来单位不存在。', 404)

  const guard = await guardFinancialMutationCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const [invoiceCount, billCount, paymentCount] = await Promise.all([
    prisma.salesInvoice.count({ where: { partyId: id } }),
    prisma.purchaseBill.count({ where: { partyId: id } }),
    prisma.finPayment.count({ where: { partyId: id } }),
  ])

  if (invoiceCount + billCount + paymentCount > 0) {
    // 有业务往来时停用而非删除，保留审计轨迹
    const party = await prisma.party.update({ where: { id }, data: { isActive: false } })
    await logAudit(guard.session.user.id, 'UPDATE', 'Party', id, before, party)
    return NextResponse.json({ party: serializeParty(party), toast: '该单位已有业务单据，已停用（未删除）。' })
  }

  await prisma.party.delete({ where: { id } })
  await logAudit(guard.session.user.id, 'DELETE', 'Party', id, before, null)
  return NextResponse.json({ toast: '往来单位已删除。' })
}
