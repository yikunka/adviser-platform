import { prisma } from '@/lib/db/prisma'
import { MAX_PRODUCT_CATEGORY_DEPTH } from '@/lib/cosmocoat/product-category-tree'

export { MAX_PRODUCT_CATEGORY_DEPTH, buildCategoryTree, flattenCategoryTree } from '@/lib/cosmocoat/product-category-tree'
export type { CategoryTreeNode } from '@/lib/cosmocoat/product-category-tree'

export type ProductCategoryRow = {
  id: string
  name: string
  description: string
  parentCategoryId: string | null
  slug: string
  image: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type ProductCategoryWithRelations = ProductCategoryRow & {
  parent: { id: string; name: string; slug: string } | null
  _count: { children: number; factoryProducts: number }
}

export function serializeProductCategory(
  category: ProductCategoryRow & {
    parent?: { id: string; name: string; slug: string } | null
    _count?: { children: number; factoryProducts: number }
  },
) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    parentCategoryId: category.parentCategoryId,
    slug: category.slug,
    image: category.image,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    parent: category.parent ?? null,
    childCount: category._count?.children ?? 0,
    productCount: category._count?.factoryProducts ?? 0,
  }
}

const categoryInclude = {
  parent: { select: { id: true, name: true, slug: true } },
  _count: { select: { children: true, factoryProducts: true } },
} as const

export async function listProductCategories() {
  const categories = await prisma.cosTableProductCategory.findMany({
    orderBy: [{ name: 'asc' }],
    include: categoryInclude,
  })
  return categories.map(serializeProductCategory)
}

export async function getProductCategoryById(id: string) {
  const category = await prisma.cosTableProductCategory.findUnique({
    where: { id },
    include: categoryInclude,
  })
  return category ? serializeProductCategory(category) : null
}

async function loadParentMap() {
  const rows = await prisma.cosTableProductCategory.findMany({
    select: { id: true, parentCategoryId: true },
  })
  return new Map(rows.map(row => [row.id, row.parentCategoryId]))
}

export async function getCategoryDepth(categoryId: string, parentMap?: Map<string, string | null>) {
  const map = parentMap ?? await loadParentMap()
  let depth = 1
  let currentId: string | null = categoryId
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const parentId: string | null = map.get(currentId) ?? null
    if (!parentId) break
    depth += 1
    if (depth > MAX_PRODUCT_CATEGORY_DEPTH) break
    currentId = parentId
  }

  return depth
}

export async function validateParentCategory(params: {
  categoryId?: string
  parentCategoryId: string | null
}) {
  const { categoryId, parentCategoryId } = params

  if (!parentCategoryId) {
    return { ok: true as const, depth: 1 }
  }

  if (categoryId && parentCategoryId === categoryId) {
    return { ok: false as const, error: '类别不能将自身设为父类别' }
  }

  const parent = await prisma.cosTableProductCategory.findUnique({
    where: { id: parentCategoryId },
    select: { id: true },
  })
  if (!parent) {
    return { ok: false as const, error: '父类别不存在' }
  }

  const parentMap = await loadParentMap()

  if (categoryId) {
    let cursor: string | null = parentCategoryId
    while (cursor) {
      if (cursor === categoryId) {
        return { ok: false as const, error: '不能将子类别设为父类别' }
      }
      cursor = parentMap.get(cursor) ?? null
    }
  }

  const parentDepth = parentCategoryId ? await getCategoryDepth(parentCategoryId, parentMap) : 0
  const depth = parentCategoryId ? parentDepth + 1 : 1
  if (depth > MAX_PRODUCT_CATEGORY_DEPTH) {
    return { ok: false as const, error: `类别层级最多 ${MAX_PRODUCT_CATEGORY_DEPTH} 层` }
  }

  if (categoryId) {
    function subtreeHeight(id: string): number {
      const children = [...parentMap.entries()].filter(([, parentId]) => parentId === id).map(([childId]) => childId)
      if (children.length === 0) return 1
      return 1 + Math.max(...children.map(subtreeHeight))
    }
    const totalDepth = depth + subtreeHeight(categoryId) - 1
    if (totalDepth > MAX_PRODUCT_CATEGORY_DEPTH) {
      return { ok: false as const, error: '移动后子类别将超过最大层级' }
    }
  }

  return { ok: true as const, depth }
}
