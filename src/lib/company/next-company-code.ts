import { prisma } from '@/lib/db/prisma'
import {
  COMPANY_JURISDICTION_CODE_PREFIX,
  type CompanyJurisdiction,
} from '@/lib/company/jurisdiction'

/**
 * Next internal company code for a jurisdiction: PREFIX + 5 digits
 * (e.g. AA00001, BV00002). Sequence is per prefix.
 */
export async function nextCompanyCode(companyType: string): Promise<string> {
  const prefix =
    COMPANY_JURISDICTION_CODE_PREFIX[companyType as CompanyJurisdiction] ?? 'AA'
  const rows = await prisma.$queryRaw<Array<{ max_no: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("companyCode" FROM 3) AS INTEGER)) AS max_no
    FROM companies
    WHERE "companyCode" ~ ${`^${prefix}[0-9]{5}$`}
  `
  const next = (rows[0]?.max_no ?? 0) + 1
  return `${prefix}${String(next).padStart(5, '0')}`
}
