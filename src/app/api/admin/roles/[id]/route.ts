import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const { name, description, color, permissions } = body

  const role = await prisma.adminRole.findUnique({ where: { id } })
  if (!role) return NextResponse.json({ error: '角色不存在' }, { status: 404 })

  if (name !== undefined && name.trim() !== role.name) {
    const existing = await prisma.adminRole.findUnique({ where: { name: name.trim() } })
    if (existing) return NextResponse.json({ error: '角色名称已存在' }, { status: 409 })
  }

  const updated = await prisma.adminRole.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(permissions !== undefined ? { permissions: Array.isArray(permissions) ? permissions : [] } : {}),
    },
    include: { _count: { select: { users: true } } },
  })

  return NextResponse.json({ role: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const { id } = await params

  const role = await prisma.adminRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  })
  if (!role) return NextResponse.json({ error: '角色不存在' }, { status: 404 })
  if (role.isSystem) return NextResponse.json({ error: '系统角色不可删除' }, { status: 400 })
  if (role._count.users > 0) {
    return NextResponse.json(
      { error: `该角色已分配给 ${role._count.users} 个用户，请先移除分配再删除` },
      { status: 400 },
    )
  }

  await prisma.adminRole.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
