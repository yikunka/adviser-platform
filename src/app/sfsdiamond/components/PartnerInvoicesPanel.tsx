import Link from 'next/link'

type PartnerInvoice = {
  id: string
  invoiceNumber: string
  status: string
  currency: string
  total: number
  issueDate: Date
  orderId: string
  sampleCode: string | null
  memorialName: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  SENT: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  PAID: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
}

export default function PartnerInvoicesPanel({ invoices }: { invoices: PartnerInvoice[] }) {
  const GOLD = '#C9A96E'
  const DARK = '#1A1A1A'
  const MUTED = '#6B5E4A'
  const CARD = '#FFFFFF'
  const BORDER = '#EDE7D8'

  return (
    <div>
      <h2 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: MUTED }}>
        Invoices
      </h2>
      {invoices.length === 0 ? (
        <div className="rounded-2xl px-5 py-6 text-sm" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
          No issued invoices yet.
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {invoices.map((inv, i) => {
            const badge = STATUS_STYLE[inv.status] ?? STATUS_STYLE.SENT
            return (
              <div
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
                style={{ borderBottom: i < invoices.length - 1 ? `1px solid ${BORDER}` : 'none' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: DARK }}>{inv.invoiceNumber}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>
                    {inv.sampleCode ? `${inv.sampleCode} · ` : ''}{inv.memorialName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                    {new Date(inv.issueDate).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.color }}>
                    {inv.status}
                  </span>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: DARK }}>
                    {inv.currency} {inv.total.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <Link
                    href={`/sfsdiamond/dashboard/${inv.orderId}`}
                    className="text-xs font-medium"
                    style={{ color: GOLD }}
                  >
                    Order
                  </Link>
                  <a
                    href={`/api/sfsdiamond/invoices/${inv.id}/pdf`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(201,169,110,0.12)', color: GOLD, border: '1px solid rgba(201,169,110,0.25)' }}
                  >
                    PDF
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
