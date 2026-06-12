import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { bankAccountUpdateSchema } from '@/lib/financial/schemas'
import { serializeBankAccount } from '@/lib/financial/subledger-serializers'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.bankAccount.findUnique({ where: { id } })
  if (!before) return apiError('银行账户不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId)
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const parsed = bankAccountUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查银行账户表单。')
  }

  if (parsed.data.glAccountId) {
    const glAccount = await prisma.finAccount.findUnique({
      where: { id: parsed.data.glAccountId },
      select: { companyId: true },
    })
    if (!glAccount || glAccount.companyId !== before.companyId) {
      return apiError('关联的总账科目不属于该公司。')
    }
  }

  try {
    const account = await prisma.bankAccount.update({
      where: { id },
      data: parsed.data,
      include: { glAccount: { select: { id: true, code: true, name: true } } },
    })
    await logAudit(guard.session.user.id, 'UPDATE', 'BankAccount', id, before, { name: account.name })
    return NextResponse.json({ bankAccount: serializeBankAccount(account), toast: '银行账户已更新。' })
  } catch (err) {
    return handleFinancialError(err)
  }
}
