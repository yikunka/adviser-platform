import { prisma } from '@/lib/db/prisma'

export async function nextKycCode() {
  const rows = await prisma.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(SUBSTRING(kyc_code FROM 3) AS INTEGER)) AS max_no
    FROM key_persons
    WHERE kyc_code ~ '^CL[0-9]{5}$'
  `
  const next = (rows[0]?.max_no ?? 0) + 1
  return `CL${String(next).padStart(5, '0')}`
}
