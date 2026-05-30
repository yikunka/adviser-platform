import { prisma } from '@/lib/db/prisma'

export async function generateColorFormulaCode(): Promise<string> {
  const now = new Date()
  const prefix = `TS${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const count = await prisma.cosTableColorFormula.count({
    where: { code: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(3, '0')}`
}
