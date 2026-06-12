import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  applyRecipeDelete,
  applyRecipeUpdate,
  createRecipeChangeRequest,
  findPendingRecipeChangeRequest,
  RecipeChangeRequestError,
  rejectPendingRecipeChangeRequests,
  validateRecipePatch,
} from '@/lib/cosmocoat/recipe-change-requests'
import { RecipeItemValidationError } from '@/lib/cosmocoat/recipe-item-validation'
import { recipePatchSchema } from '@/lib/cosmocoat/recipe-patch-schema'
import { serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params
  try {
    const [recipe, pendingChangeRequest] = await Promise.all([
      serializeFullRecipe(id),
      findPendingRecipeChangeRequest(id),
    ])
    if (!recipe) return NextResponse.json({ error: '配方不存在' }, { status: 404 })
    return NextResponse.json({
      recipe,
      canDirectEdit: session!.user.role === 'SUPER_ADMIN',
      pendingChangeRequest: pendingChangeRequest
        ? {
            id: pendingChangeRequest.id,
            action: pendingChangeRequest.action,
            status: pendingChangeRequest.status,
            createdAt: pendingChangeRequest.createdAt.toISOString(),
            requestedBy: pendingChangeRequest.requestedBy,
          }
        : null,
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = recipePatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosTableRecipe.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

  if (session!.user.role !== 'SUPER_ADMIN') {
    try {
      await validateRecipePatch(id, parsed.data, current)
      const changeRequest = await createRecipeChangeRequest({
        recipeId: id,
        action: 'UPDATE',
        payload: parsed.data,
        requestedById: session!.user.id,
      })
      return NextResponse.json(
        {
          changeRequest,
          message: '变更已提交，等待超级管理员审批',
        },
        { status: 202 },
      )
    } catch (err) {
      if (err instanceof RecipeChangeRequestError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      if (err instanceof RecipeItemValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      if (isMissingTable(err)) {
        return NextResponse.json({ error: '配方审批表不存在，请先运行数据库迁移' }, { status: 503 })
      }
      throw err
    }
  }

  try {
    if (session!.user.role === 'SUPER_ADMIN') {
      await rejectPendingRecipeChangeRequests(id, session!.user.id, '超级管理员已直接执行变更')
    }
    const recipe = await applyRecipeUpdate(id, parsed.data, body)
    return NextResponse.json({ recipe })
  } catch (err) {
    if (err instanceof RecipeChangeRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof RecipeItemValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableRecipe.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '配方不存在' }, { status: 404 })

  if (session!.user.role !== 'SUPER_ADMIN') {
    try {
      const changeRequest = await createRecipeChangeRequest({
        recipeId: id,
        action: 'DELETE',
        requestedById: session!.user.id,
      })
      return NextResponse.json(
        {
          changeRequest,
          message: '删除请求已提交，等待超级管理员审批',
        },
        { status: 202 },
      )
    } catch (err) {
      if (err instanceof RecipeChangeRequestError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      if (isMissingTable(err)) {
        return NextResponse.json({ error: '配方审批表不存在，请先运行数据库迁移' }, { status: 503 })
      }
      throw err
    }
  }

  try {
    if (session!.user.role === 'SUPER_ADMIN') {
      await rejectPendingRecipeChangeRequests(id, session!.user.id, '超级管理员已直接执行变更')
    }
    await applyRecipeDelete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof RecipeChangeRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
