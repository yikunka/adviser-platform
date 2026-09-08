import { prisma } from '@/lib/db/prisma'

type ProjectNumberClient = Pick<typeof prisma, '$executeRaw' | '$queryRaw'>

const MAX_SEQUENCE_SCAN = 1000

/** Next sequential project number: PRJ-YYYY-NNNNN */
export async function nextProjectNumber(
  referenceDate: Date = new Date(),
  db: ProjectNumberClient = prisma,
  options: { lockSequence?: boolean } = {},
): Promise<string> {
  const year = referenceDate.getFullYear()
  const prefix = `PRJ-${year}-`

  if (options.lockSequence) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`adv-project:${year}`}))`
  }

  const rows = await db.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("projectNumber" FROM ${String(prefix.length + 1)}) AS INTEGER)) AS max_no
    FROM adv_projects
    WHERE "projectNumber" ~ ${`^PRJ-${year}-[0-9]{5}$`}
  `
  let next = (rows[0]?.max_no ?? 0) + 1

  for (let attempt = 0; attempt < MAX_SEQUENCE_SCAN; attempt += 1) {
    const projectNumber = `${prefix}${String(next).padStart(5, '0')}`
    const existing = await db.$queryRaw<Array<{ exists: number }>>`
      SELECT 1 AS exists
      FROM adv_projects
      WHERE "projectNumber" = ${projectNumber}
      LIMIT 1
    `
    if (existing.length === 0) return projectNumber
    next += 1
  }

  throw new Error(`Unable to allocate project number for ${year}`)
}
