import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany } from '@/lib/financial/api-guard'
import { buildPartyStatement, type StatementEvent } from '@/lib/financial/party-statement'

/** 往来对账单：?side=ar|ap（客户对账单 / 供应商对账单） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const party = await prisma.party.findUnique({
    where: { id },
    select: { id: true, companyId: true, code: true, name: true, isCustomer: true, isSupplier: true },
  })
  if (!party) return apiError('往来单位不存在。', 404)

  const guard = await guardFinancialCompany(party.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const side = req.nextUrl.searchParams.get('side') === 'ap' ? 'ap' : 'ar'
  const events: StatementEvent[] = []

  if (side === 'ar') {
    const [invoices, receipts, creditNotes] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: { partyId: id, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] } },
        select: { invoiceNo: true, issueDate: true, total: true, notes: true },
      }),
      prisma.finPayment.findMany({
        where: { partyId: id, direction: 'RECEIPT', status: 'POSTED' },
        select: { paymentNo: true, paymentDate: true, amount: true, reference: true },
      }),
      prisma.finCreditNote.findMany({
        where: { partyId: id, kind: 'CUSTOMER', status: 'POSTED' },
        select: { noteNo: true, issueDate: true, total: true, reason: true },
      }),
    ])
    for (const invoice of invoices) {
      events.push({
        date: invoice.issueDate,
        type: 'SALES_INVOICE',
        docNo: invoice.invoiceNo,
        description: invoice.notes || '销售发票',
        charge: Number(invoice.total),
        settle: 0,
      })
    }
    for (const receipt of receipts) {
      events.push({
        date: receipt.paymentDate,
        type: 'RECEIPT',
        docNo: receipt.paymentNo,
        description: receipt.reference || '收款',
        charge: 0,
        settle: Number(receipt.amount),
      })
    }
    for (const note of creditNotes) {
      events.push({
        date: note.issueDate,
        type: 'CREDIT_NOTE',
        docNo: note.noteNo,
        description: note.reason || '贷项通知单',
        charge: 0,
        settle: Number(note.total),
      })
    }
  } else {
    const [bills, payments, debitNotes] = await Promise.all([
      prisma.purchaseBill.findMany({
        where: { partyId: id, status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] } },
        select: { billNo: true, billDate: true, total: true, notes: true },
      }),
      prisma.finPayment.findMany({
        where: { partyId: id, direction: 'PAYMENT', status: 'POSTED' },
        select: { paymentNo: true, paymentDate: true, amount: true, reference: true },
      }),
      prisma.finCreditNote.findMany({
        where: { partyId: id, kind: 'SUPPLIER', status: 'POSTED' },
        select: { noteNo: true, issueDate: true, total: true, reason: true },
      }),
    ])
    for (const bill of bills) {
      events.push({
        date: bill.billDate,
        type: 'PURCHASE_BILL',
        docNo: bill.billNo,
        description: bill.notes || '采购账单',
        charge: Number(bill.total),
        settle: 0,
      })
    }
    for (const payment of payments) {
      events.push({
        date: payment.paymentDate,
        type: 'BILL_PAYMENT',
        docNo: payment.paymentNo,
        description: payment.reference || '付款',
        charge: 0,
        settle: Number(payment.amount),
      })
    }
    for (const note of debitNotes) {
      events.push({
        date: note.issueDate,
        type: 'DEBIT_NOTE',
        docNo: note.noteNo,
        description: note.reason || '借项通知单',
        charge: 0,
        settle: Number(note.total),
      })
    }
  }

  const statement = buildPartyStatement(events)
  return NextResponse.json({
    party: { id: party.id, code: party.code, name: party.name },
    side,
    statement: {
      ...statement,
      rows: statement.rows.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10) })),
    },
  })
}
