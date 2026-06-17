import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const { error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const roles = await prisma.adminRole.findMany({
    orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    include: { _count: { select: { users: true } } },
  })

  return NextResponse.json({ roles })
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const body = await req.json()
  const { name, description = '', color = '#6b7280', permissions = [] } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: '角色名称不能为空' }, { status: 400 })
  }

  const existing = await prisma.adminRole.findUnique({ where: { name: name.trim() } })
  if (existing) {
    return NextResponse.json({ error: '角色名称已存在' }, { status: 409 })
  }

  const role = await prisma.adminRole.create({
    data: {
      name: name.trim(),
      description: description.trim(),
      color,
      permissions: Array.isArray(permissions) ? permissions : [],
    },
    include: { _count: { select: { users: true } } },
  })

  return NextResponse.json({ role }, { status: 201 })
}
