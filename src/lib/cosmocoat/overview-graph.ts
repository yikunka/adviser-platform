import type { Prisma } from '@prisma/client'

export function buildOverviewRawMaterialWhere(): Prisma.CosTableRawMaterialWhereInput {
  return {
    recipeItems: {
      some: {},
    },
  }
}
