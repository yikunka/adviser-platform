import { prisma } from '@/lib/db/prisma'

type InvoiceNumberClient = Pick<typeof prisma, '$executeRaw' | '$queryRaw'>

const MAX_SEQUENCE_SCAN = 1000

/** Next sequential invoice number: INV-YYYY-NNNNN */
export async function nextInvoiceNumber(
  issueDate: Date,
  db: InvoiceNumberClient = prisma,
  options: { lockSequence?: boolean } = {},
): Promise<string> {
  const year = issueDate.getFullYear()
  const prefix = `INV-${year}-`

  if (options.lockSequence) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${year}`}))`
  }

  const rows = await db.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("invoiceNumber" FROM ${String(prefix.length + 1)}) AS INTEGER)) AS max_no
    FROM invoices
    WHERE "invoiceNumber" ~ ${`^INV-${year}-[0-9]{5}$`}
  `
  let next = (rows[0]?.max_no ?? 0) + 1

  for (let attempt = 0; attempt < MAX_SEQUENCE_SCAN; attempt += 1) {
    const invoiceNumber = `${prefix}${String(next).padStart(5, '0')}`
    const existing = await db.$queryRaw<Array<{ exists: number }>>`
      SELECT 1 AS exists
      FROM invoices
      WHERE "invoiceNumber" = ${invoiceNumber}
      LIMIT 1
    `
    if (existing.length === 0) return invoiceNumber
    next += 1
  }

  throw new Error(`Unable to allocate invoice number for ${year}`)
}
