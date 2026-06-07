import { prisma } from '@/lib/db/prisma'

type SfsInvoiceNumberClient = Pick<typeof prisma, '$executeRaw' | '$queryRaw'>

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
  const next = (rows[0]?.max_no ?? 0) + 1
  return `${yy}${String(next).padStart(6, '0')}`
}
