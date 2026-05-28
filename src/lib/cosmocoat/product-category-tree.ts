export const MAX_PRODUCT_CATEGORY_DEPTH = 3

export type CategoryTreeNode = {
  id: string
  name: string
  slug: string
  parentCategoryId: string | null
  depth: number
  pathLabel: string
  children: CategoryTreeNode[]
}

export function buildCategoryTree(
  categories: Array<{
    id: string
    name: string
    slug: string
    parentCategoryId: string | null
    isActive: boolean
  }>,
  options?: { activeOnly?: boolean },
): CategoryTreeNode[] {
  const activeOnly = options?.activeOnly ?? false
  const filtered = activeOnly ? categories.filter(c => c.isActive) : categories
  const byId = new Map(filtered.map(c => [c.id, c]))
  const nodes = new Map<string, CategoryTreeNode>()

  for (const category of filtered) {
    nodes.set(category.id, {
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentCategoryId: category.parentCategoryId,
      depth: 1,
      pathLabel: category.name,
      children: [],
    })
  }

  const roots: CategoryTreeNode[] = []

  for (const category of filtered) {
    const node = nodes.get(category.id)!
    const parentId = category.parentCategoryId
    if (parentId && nodes.has(parentId)) {
      const parent = nodes.get(parentId)!
      node.depth = parent.depth + 1
      node.pathLabel = `${parent.pathLabel} / ${node.name}`
      parent.children.push(node)
    } else if (!parentId || !byId.has(parentId)) {
      roots.push(node)
    }
  }

  function sortNodes(list: CategoryTreeNode[]) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    for (const child of list) sortNodes(child.children)
  }
  sortNodes(roots)

  return roots
}

export function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = []
  function walk(list: CategoryTreeNode[]) {
    for (const node of list) {
      result.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return result
}
