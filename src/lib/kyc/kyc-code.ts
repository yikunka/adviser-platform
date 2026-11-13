import { prisma } from '@/lib/db/prisma'

/** Format: CL0000, CL0001, … (4-digit sequence). */
export function formatKycCode(seq: number): string {
  if (!Number.isInteger(seq) || seq < 0) {
    throw new Error(`Invalid KYC sequence: ${seq}`)
  }
  return `CL${String(seq).padStart(4, '0')}`
}

export async function nextKycCode() {
  // Include any historic CL + digits width so we never reuse a numeric suffix.
  const rows = await prisma.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(SUBSTRING(kyc_code FROM 3) AS INTEGER)) AS max_no
    FROM key_persons
    WHERE kyc_code ~ '^CL[0-9]+$'
  `
  const next = (rows[0]?.max_no ?? -1) + 1
  return formatKycCode(next)
}
