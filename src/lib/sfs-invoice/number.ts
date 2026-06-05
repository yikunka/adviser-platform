import { prisma } from '@/lib/db/prisma'

/** Next sequential SFS invoice number: YY + 6-digit sequence, e.g. 26000001 */
export async function nextSfsInvoiceNumber(issueDate: Date): Promise<string> {
  const yy = String(issueDate.getFullYear() % 100).padStart(2, '0')
  const pattern = `^${yy}[0-9]{6}$`
  const rows = await prisma.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(RIGHT("invoiceNumber", 6) AS INTEGER)) AS max_no
    FROM sfs_invoices
    WHERE "invoiceNumber" ~ ${pattern}
  `
  const next = (rows[0]?.max_no ?? 0) + 1
  return `${yy}${String(next).padStart(6, '0')}`
}
