import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { SFS_TOTAL_PREDEFINED_STEPS } from '@/lib/sfs/order-predefined-steps'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E'  },
  QUOTED:    { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6'  },
  CONFIRMED: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981'  },
  COMPLETED: { bg: 'rgba(120,113,108,0.15)', color: '#7A7060'  },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444'  },
}

const TOTAL_STEPS = SFS_TOTAL_PREDEFINED_STEPS

export default async function SFSDashboardPage() {
  const session = await auth()
  const orders = await prisma.sfsOrder.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { steps: true } } },
  })

  const GOLD   = '#C9A96E'
  const DARK   = '#1A1A1A'
  const MUTED  = '#6B5E4A'
  const BG     = '#FAFAF8'
  const CARD   = '#FFFFFF'
  const BORDER = '#EDE7D8'

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Welcome + Place Order */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: DARK }}>
              My Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: MUTED }}>
              Welcome back, {session!.user.name ?? 'valued client'}
            </p>
          </div>
          <Link
            href="/sfsdiamond/order"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all hover:opacity-90 self-start sm:self-auto"
            style={{ background: GOLD, color: '#0A0805' }}
          >
            ✦ Place New Order
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Orders', value: orders.length },
            { label: 'Pending',      value: orders.filter(o => o.status === 'PENDING').length },
            { label: 'Confirmed',    value: orders.filter(o => o.status === 'CONFIRMED').length },
            { label: 'Completed',    value: orders.filter(o => o.status === 'COMPLETED').length },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl p-5"
              style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
            >
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: MUTED }}>{s.label}</p>
              <p className="text-3xl font-bold" style={{ color: s.value > 0 ? GOLD : MUTED }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Order list */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: MUTED }}>
            My Orders
          </h2>

          {orders.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{ background: CARD, border: `1px solid ${BORDER}` }}
            >
              <p className="text-4xl mb-4">◈</p>
              <p className="font-medium mb-2" style={{ color: DARK }}>No orders yet</p>
              <p className="text-sm mb-6" style={{ color: MUTED }}>
                Begin your memorial diamond journey by placing your first order.
              </p>
              <Link
                href="/sfsdiamond/order"
                className="inline-block px-6 py-3 rounded-full text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: GOLD, color: '#0A0805' }}
              >
                Place Your First Order
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {orders.map((order, i) => {
                const badge = STATUS_STYLE[order.status] ?? STATUS_STYLE.PENDING
                const diamonds = order.diamonds as { carat?: string; shape?: string; type?: string }[]
                const summary = diamonds
                  .slice(0, 2)
                  .map(d => [d.carat ? `${d.carat}ct` : '', d.shape, d.type].filter(Boolean).join(' '))
                  .join(', ')
                const extra = diamonds.length > 2 ? ` +${diamonds.length - 2} more` : ''
                const stepsDone = order._count.steps
                const pct = Math.round((stepsDone / TOTAL_STEPS) * 100)

                return (
                  <div
                    key={order.id}
                    className="flex items-center gap-4 px-5 py-4"
                    style={{ borderBottom: i < orders.length - 1 ? `1px solid ${BORDER}` : 'none' }}
                  >
                    {/* Diamond count bubble */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'rgba(201,169,110,0.1)', color: GOLD, border: '1px solid rgba(201,169,110,0.2)' }}
                    >
                      {diamonds.length}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: DARK }}>{order.memorialName}</p>
                      {order.sampleCode && (
                        <p className="text-[11px] mt-0.5 font-mono truncate" style={{ color: GOLD }}>
                          Order ID: {order.sampleCode}
                        </p>
                      )}
                      <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>{summary}{extra}</p>
                      {stepsDone > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(201,169,110,0.15)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : GOLD }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: MUTED }}>{stepsDone}/{TOTAL_STEPS} steps</span>
                        </div>
                      )}
                    </div>

                    {/* Status + date + link */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.color }}>
                        {order.status}
                      </span>
                      <p className="text-xs" style={{ color: MUTED }}>
                        {new Date(order.createdAt).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <Link
                        href={`/sfsdiamond/dashboard/${order.id}`}
                        className="text-xs font-medium px-3 py-1 rounded-lg transition-all hover:opacity-80"
                        style={{ background: 'rgba(201,169,110,0.1)', color: GOLD, border: '1px solid rgba(201,169,110,0.2)' }}
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
