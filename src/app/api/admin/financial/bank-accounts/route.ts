import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { bankGlBalanceAsOf } from '@/lib/financial/bank-accounts'
import { bankAccountSchema } from '@/lib/financial/schemas'
import { serializeBankAccount } from '@/lib/financial/subledger-serializers'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId, { requireManager: true })
  if (guard.error) return guard.error

  const accounts = await prisma.bankAccount.findMany({
    where: { companyId: companyId! },
    include: { glAccount: { select: { id: true, code: true, name: true } } },
    orderBy: { name: 'asc' },
  })

  const withBalances = await Promise.all(
    accounts.map(async account => ({
      ...serializeBankAccount(account),
      glBalance: await bankGlBalanceAsOf({
        companyId: companyId!,
        glAccountId: account.glAccountId,
        asOf: new Date(),
      }),
    })),
  )

  return NextResponse.json({ bankAccounts: withBalances })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = bankAccountSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查银行账户表单。')
  }

  const guard = await guardFinancialCompany(parsed.data.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const glAccount = await prisma.finAccount.findUnique({
    where: { id: parsed.data.glAccountId },
    select: { companyId: true },
  })
  if (!glAccount || glAccount.companyId !== parsed.data.companyId) {
    return apiError('关联的总账科目不属于该公司。')
  }

  try {
    const account = await prisma.bankAccount.create({
      data: parsed.data,
      include: { glAccount: { select: { id: true, code: true, name: true } } },
    })
    await logAudit(guard.session.user.id, 'CREATE', 'BankAccount', account.id, null, { name: account.name })
    return NextResponse.json(
      { bankAccount: serializeBankAccount(account), toast: `银行账户「${account.name}」已创建。` },
      { status: 201 },
    )
  } catch (err) {
    return handleFinancialError(err)
  }
}
