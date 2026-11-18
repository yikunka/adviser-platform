import { prisma } from '@/lib/db/prisma'
import {
  COMPANY_JURISDICTION_CODE_PREFIX,
  type CompanyJurisdiction,
} from '@/lib/company/jurisdiction'

/** Digit width for new codes (AA0001, BV0003, …). */
const CODE_DIGITS = 4

/**
 * Next internal company code: jurisdiction PREFIX + shared global sequence.
 * Example: HK → AA0001, AA0002; next BVI → BV0003 (one counter across all jurisdictions).
 * Max is taken from any existing `XX####…` code so legacy 5-digit rows still advance the sequence.
 */
export async function nextCompanyCode(companyType: string): Promise<string> {
  const prefix =
    COMPANY_JURISDICTION_CODE_PREFIX[companyType as CompanyJurisdiction] ?? 'AA'
  const rows = await prisma.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("companyCode" FROM 3) AS INTEGER)) AS max_no
    FROM companies
    WHERE "companyCode" ~ '^[A-Z]{2}[0-9]+$'
  `
  const next = (rows[0]?.max_no ?? 0) + 1
  return `${prefix}${String(next).padStart(CODE_DIGITS, '0')}`
}
