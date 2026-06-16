import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { syncNar1ToRegisters } from '@/lib/company/nar1-sync'

const personSchema = z.object({
  nameEn: z.string(),
  nameZh: z.string().optional(),
}).passthrough()

const bodySchema = z.object({
  data: z.object({
    directors: z.array(personSchema),
    members: z.array(personSchema),
    significantControllers: z.array(personSchema),
  }),
  annualReturnDate: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id: companyId } = await params
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return NextResponse.json({ error: '公司不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const summary = await syncNar1ToRegisters(
    companyId,
    parsed.data.data as never,
    parsed.data.annualReturnDate,
  )

  await logAudit(session!.user.id, 'UPDATE', 'Company', companyId, null, { nar1Sync: summary })

  return NextResponse.json({ success: true, summary })
}
