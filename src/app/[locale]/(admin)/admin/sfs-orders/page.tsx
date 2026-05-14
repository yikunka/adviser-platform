import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { Link } from '@/i18n/navigation'
import { Diamond } from 'lucide-react'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E' },
  QUOTED:    { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  CONFIRMED: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  COMPLETED: { bg: 'rgba(120,113,108,0.15)', color: '#7A7060' },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}

export default async function AdminSfsOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await auth()
  const { locale } = await params

  const orders = await prisma.sfsOrder.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { steps: true } } },
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            SFS Diamond Orders
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {orders.length} order{orders.length !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Diamond size={32} style={{ color: '#C9A96E', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No orders yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(201,169,110,0.04)' }}>
                {['Sample Code', 'Memorial', 'Client', 'Source', 'Color', 'Diamonds', 'Steps', 'Status', 'Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const s = STATUS_STYLE[order.status] ?? STATUS_STYLE.PENDING
                const diamonds = order.diamonds as { carat?: string }[]
                const color = order.color
                return (
                  <tr
                    key={order.id}
                    style={{ borderBottom: i < orders.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#C9A96E' }}>
                      {order.sampleCode ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>
                      {order.memorialName}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                      <div>{order.clientName}</div>
                      <div className="text-xs">{order.email}</div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>
                      {order.sourceType}
                    </td>
                    <td className="px-4 py-3">
                      {color ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E' }}>
                          {color}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--foreground)' }}>
                      {diamonds.length}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--muted-foreground)' }}>
                      {order._count.steps}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(order.createdAt).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/sfs-orders/${order.id}`}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
