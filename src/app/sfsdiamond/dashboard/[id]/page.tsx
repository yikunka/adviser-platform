import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import DiamondCards from '@/app/sfsdiamond/components/DiamondCards'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E'  },
  QUOTED:    { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6'  },
  CONFIRMED: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981'  },
  COMPLETED: { bg: 'rgba(120,113,108,0.15)', color: '#7A7060'  },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444'  },
}

const PHASE_LABELS: Record<string, string> = {
  CHEM_TRANSFORM: 'Chemical Transformation',
  CVD:            'CVD Growth',
  CRAFTING:       'Crafting & Jewelry Setting',
}

const PHASE_ORDER = ['CHEM_TRANSFORM', 'CVD', 'CRAFTING']
const TOTAL_STEPS: Record<string, number> = { CHEM_TRANSFORM: 10, CVD: 6, CRAFTING: 4 }

function fileUrl(key: string) {
  return `/api/files?key=${encodeURIComponent(key)}`
}

function fileName(key: string) {
  return key.split('/').pop() ?? key
}

export default async function SFSOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect('/sfsdiamond/login')

  const { id } = await params
  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: { steps: { orderBy: [{ phase: 'asc' }, { stepNumber: 'asc' }] } },
  })

  if (!order || order.userId !== session.user.id) notFound()

  const GOLD   = '#C9A96E'
  const DARK   = '#1A1A1A'
  const MUTED  = '#6B5E4A'
  const BG     = '#FAFAF8'
  const CARD   = '#FFFFFF'
  const BORDER = '#EDE7D8'

  const badge = STATUS_STYLE[order.status] ?? STATUS_STYLE.PENDING
  const diamonds = order.diamonds as { carat?: string; shape?: string; type?: string; size?: string; cut?: string; mountStyle?: string; metal?: string }[]

  const phaseGroups = PHASE_ORDER.map(phase => ({
    phase,
    label: PHASE_LABELS[phase],
    total: TOTAL_STEPS[phase],
    steps: order.steps.filter(s => s.phase === phase),
  }))

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Back + header */}
        <div>
          <Link
            href="/sfsdiamond/dashboard"
            className="inline-flex items-center gap-1 text-xs mb-4 hover:opacity-70"
            style={{ color: MUTED }}
          >
            ← Back to Dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: DARK }}>
              {order.memorialName}
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.color }}>
              {order.status}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: MUTED }}>
            Order placed {new Date(order.createdAt).toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Admin remark to customer */}
        {order.customerRemark && (
          <div
            className="rounded-2xl p-5 flex gap-4"
            style={{ background: 'rgba(201,169,110,0.08)', border: `1px solid rgba(201,169,110,0.3)` }}
          >
            <span className="text-xl flex-shrink-0">💬</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>
                Message from SFS Diamond
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: DARK }}>
                {order.customerRemark}
              </p>
            </div>
          </div>
        )}

        {/* Diamond summary */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
              Your Diamonds ({diamonds.length})
            </h2>
            {order.color && (
              <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: 'rgba(201,169,110,0.1)', color: GOLD }}>
                {order.color}
              </span>
            )}
          </div>
          <DiamondCards diamonds={diamonds} />
        </div>

        {/* Production progress */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            Production Progress
          </h2>

          {phaseGroups.map(group => {
            const pct = group.total > 0 ? (group.steps.length / group.total) * 100 : 0
            const isComplete = group.steps.length === group.total

            return (
              <div
                key={group.phase}
                className="rounded-2xl overflow-hidden"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
              >
                {/* Phase header */}
                <div
                  className="px-5 py-3 flex items-center justify-between"
                  style={{ background: 'rgba(201,169,110,0.03)', borderBottom: `1px solid ${BORDER}` }}
                >
                  <p className="font-semibold text-sm" style={{ color: DARK }}>{group.label}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(201,169,110,0.15)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: isComplete ? '#10b981' : GOLD }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: MUTED }}>
                      {group.steps.length}/{group.total}
                    </span>
                  </div>
                </div>

                {group.steps.length === 0 ? (
                  <p className="px-5 py-4 text-sm" style={{ color: MUTED }}>Not started yet</p>
                ) : (
                  <div className="divide-y" style={{ ['--tw-divide-opacity' as string]: 1 }}>
                    {group.steps.map(step => (
                      <div key={step.id} className="px-5 py-4 flex items-start gap-3" style={{ borderColor: BORDER }}>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                          style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                        >
                          ✓
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <p className="text-sm font-medium" style={{ color: DARK }}>{step.particular}</p>
                            <p className="text-xs" style={{ color: MUTED }}>
                              {new Date(step.recordedAt).toLocaleString('en-HK', {
                                day: 'numeric', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          </div>
                          {step.notes && (
                            <p className="text-xs mt-1 italic" style={{ color: MUTED }}>{step.notes}</p>
                          )}
                          {step.fileKeys.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {step.fileKeys.map((key, ki) => {
                                const name = fileName(key)
                                const isImage = /\.(jpg|jpeg|png|webp)$/i.test(name)
                                return isImage ? (
                                  <a key={ki} href={fileUrl(key)} target="_blank" rel="noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={fileUrl(key)}
                                      alt={name}
                                      className="w-20 h-20 object-cover rounded-xl"
                                      style={{ border: `1px solid ${BORDER}` }}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={ki}
                                    href={fileUrl(key)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                                    style={{ background: 'rgba(201,169,110,0.08)', color: GOLD, border: `1px solid rgba(201,169,110,0.2)` }}
                                  >
                                    📄 {name}
                                  </a>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
