import { prisma } from '@/lib/db/prisma'

type SfsInvoiceNumberClient = Pick<typeof prisma, '$executeRaw' | '$queryRaw'>

const MAX_SEQUENCE_SCAN = 1000

/** Next sequential SFS invoice number: YY + 6-digit sequence, e.g. 26000001 */
export async function nextSfsInvoiceNumber(
  issueDate: Date,
  db: SfsInvoiceNumberClient = prisma,
  options: { lockSequence?: boolean } = {},
): Promise<string> {
  const yy = String(issueDate.getFullYear() % 100).padStart(2, '0')
  const pattern = `^${yy}[0-9]{6}$`

  if (options.lockSequence) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sfs-invoice:${yy}`}))`
  }

  const rows = await db.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(RIGHT("invoiceNumber", 6) AS INTEGER)) AS max_no
    FROM sfs_invoices
    WHERE "invoiceNumber" ~ ${pattern}
  `
  let next = (rows[0]?.max_no ?? 0) + 1

  for (let attempt = 0; attempt < MAX_SEQUENCE_SCAN; attempt += 1) {
    const invoiceNumber = `${yy}${String(next).padStart(6, '0')}`
    const existing = await db.$queryRaw<Array<{ exists: number }>>`
      SELECT 1 AS exists
      FROM sfs_invoices
      WHERE "invoiceNumber" = ${invoiceNumber}
      LIMIT 1
    `
    if (existing.length === 0) return invoiceNumber
    next += 1
  }

  throw new Error(`Unable to allocate SFS invoice number for ${yy}`)
}
