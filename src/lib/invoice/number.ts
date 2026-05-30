import { prisma } from '@/lib/db/prisma'

/** Next sequential invoice number: INV-YYYY-NNNNN */
export async function nextInvoiceNumber(issueDate: Date): Promise<string> {
  const year = issueDate.getFullYear()
  const prefix = `INV-${year}-`
  const rows = await prisma.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("invoiceNumber" FROM ${String(prefix.length + 1)}) AS INTEGER)) AS max_no
    FROM invoices
    WHERE "invoiceNumber" ~ ${`^INV-${year}-[0-9]{5}$`}
  `
  const next = (rows[0]?.max_no ?? 0) + 1
  return `${prefix}${String(next).padStart(5, '0')}`
}
