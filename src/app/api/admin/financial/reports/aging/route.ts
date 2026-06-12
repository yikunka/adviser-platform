import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { buildAgingReport, type AgingDocInput } from '@/lib/financial/aging'
import { apiError, guardFinancialCompany } from '@/lib/financial/api-guard'
import { parseYmdDate, roundMoney } from '@/lib/financial/utils'

/** AR / AP 账龄报表：?companyId=&side=ar|ap&asOf=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const side = req.nextUrl.searchParams.get('side') === 'ap' ? 'ap' : 'ar'
  const asOfParam = req.nextUrl.searchParams.get('asOf')
  const asOf = asOfParam && /^\d{4}-\d{2}-\d{2}$/.test(asOfParam) ? parseYmdDate(asOfParam) : new Date()
  if (Number.isNaN(asOf.getTime())) return apiError('asOf 日期无效。')

  let docs: AgingDocInput[]
  if (side === 'ar') {
    const invoices = await prisma.salesInvoice.findMany({
      where: { companyId: companyId!, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
      select: {
        id: true,
        invoiceNo: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        party: { select: { id: true, code: true, name: true } },
      },
    })
    docs = invoices.map(invoice => ({
      docId: invoice.id,
      docNo: invoice.invoiceNo,
      partyId: invoice.party.id,
      partyName: invoice.party.name,
      partyCode: invoice.party.code,
      docDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      outstanding: roundMoney(Number(invoice.total) - Number(invoice.amountPaid)),
    }))
  } else {
    const bills = await prisma.purchaseBill.findMany({
      where: { companyId: companyId!, status: { in: ['POSTED', 'PARTIALLY_PAID'] } },
      select: {
        id: true,
        billNo: true,
        billDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        party: { select: { id: true, code: true, name: true } },
      },
    })
    docs = bills.map(bill => ({
      docId: bill.id,
      docNo: bill.billNo,
      partyId: bill.party.id,
      partyName: bill.party.name,
      partyCode: bill.party.code,
      docDate: bill.billDate,
      dueDate: bill.dueDate,
      outstanding: roundMoney(Number(bill.total) - Number(bill.amountPaid)),
    }))
  }

  return NextResponse.json({ report: buildAgingReport(docs, asOf), side })
}
