import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import DiamondCards from '@/app/sfsdiamond/components/DiamondCards'
import CustomerInternalOrderCodeField from '@/app/sfsdiamond/components/CustomerInternalOrderCodeField'
import {
  groupSfsStepFilesByDiamond,
  sfsCustomerVisibleStepFileKeys,
  sfsStepFileDiamondLabel,
  sfsStepRequiresDiamondImages,
  splitSfsStepNotes,
} from '@/lib/sfs/order-step-display'
import { SFS_PHASE_LABELS, SFS_PHASE_ORDER } from '@/lib/sfs/order-predefined-steps'
import { matchCompletedStep, resolveOrderStepPlan } from '@/lib/sfs/order-step-plan'
import { summarizeProjectBilling } from '@/lib/adviser/project-labels'
import { buildSfsOrderTracker } from '@/lib/sfs/order-tracker'
import { SfsProductionTracker } from '@/components/sfs/SfsProductionTracker'
import QuoteResponseActions from '@/app/sfsdiamond/components/QuoteResponseActions'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: 'rgba(201,169,110,0.12)', color: '#C9A96E'  },
  QUOTED:    { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6'  },
  CONFIRMED: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981'  },
  COMPLETED: { bg: 'rgba(120,113,108,0.15)', color: '#7A7060'  },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444'  },
}

function fileUrl(key: string) {
  return `/api/files?key=${encodeURIComponent(key)}`
}

function fileName(key: string) {
  return key.split('/').pop() ?? key
}

function StepFilePreview({
  fileKey,
  label,
  borderColor,
  gold,
}: {
  fileKey: string
  label?: string | null
  borderColor: string
  gold: string
}) {
  const name = fileName(fileKey)
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(name)

  if (isImage) {
    return (
      <a href={fileUrl(fileKey)} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl(fileKey)}
          alt={label ? `${label} ${name}` : name}
          className="w-20 h-20 object-cover rounded-xl"
          style={{ border: `1px solid ${borderColor}` }}
        />
        {label && (
          <span className="mt-1 block max-w-20 truncate text-center text-[10px] font-mono font-semibold" style={{ color: gold }}>
            {label}
          </span>
        )}
      </a>
    )
  }

  return (
    <a
      href={fileUrl(fileKey)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
      style={{ background: 'rgba(201,169,110,0.08)', color: gold, border: `1px solid rgba(201,169,110,0.2)` }}
    >
      📄 {label ? `${label} · ` : ''}{name}
    </a>
  )
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
    include: {
      steps: {
        orderBy: [{ phase: 'asc' }, { stepNumber: 'asc' }],
        include: { attachments: { orderBy: { createdAt: 'asc' } } },
      },
      invoices: { select: { status: true } },
    },
  })

  if (!order || order.userId !== session.user.id) notFound()

  const GOLD   = '#C9A96E'
  const DARK   = '#1A1A1A'
  const MUTED  = '#6B5E4A'
  const BG     = '#FAFAF8'
  const CARD   = '#FFFFFF'
  const BORDER = '#EDE7D8'

  const issuedInvoices = order.invoices.filter(invoice => invoice.status === 'SENT' || invoice.status === 'PAID')
  const billing = summarizeProjectBilling(issuedInvoices.map(invoice => invoice.status))
  const tracker = buildSfsOrderTracker(order)
  const badge = STATUS_STYLE[order.status] ?? STATUS_STYLE.PENDING
  const diamonds = order.diamonds as { code?: string; carat?: string; shape?: string; type?: string; design?: string; metal?: string; ringSize?: string }[]

  // Use per-order step plan (or defaults) for consistent display with admin
  const stepPlan = resolveOrderStepPlan(order.stepPlan)

  const phaseGroups = SFS_PHASE_ORDER.map(phase => {
    const planSteps = stepPlan[phase] ?? []
    const phaseDone = order.steps.filter(s => s.phase === phase)
    return {
      phase,
      label: SFS_PHASE_LABELS[phase],
      total: planSteps.length,
      planSteps,
      steps: planSteps
        .map((item, i) => {
          const done = matchCompletedStep(item, i, phaseDone)
          return done ? { ...done, displayName: item.label, defaultKey: item.defaultKey } : null
        })
        .filter(Boolean) as Array<(typeof order.steps)[number] & { displayName: string; defaultKey?: string }>,
    }
  })

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
            {['PENDING', 'QUOTED', 'CANCELLED'].includes(order.status) && (
              <Link
                href={`/sfsdiamond/orders/${order.id}/edit`}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80"
                style={{ background: 'rgba(201,169,110,0.12)', color: GOLD, border: `1px solid rgba(201,169,110,0.3)` }}
              >
                ✎ Edit Order
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-sm" style={{ color: MUTED }}>
              Order placed {new Date(order.createdAt).toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {order.sampleCode && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide"
                style={{ background: 'rgba(201,169,110,0.12)', color: GOLD, border: `1px solid rgba(201,169,110,0.25)` }}
              >
                ✦ {order.sampleCode}
              </span>
            )}
            {order.status === 'COMPLETED' && (
              <a
                href={`/api/sfsdiamond/orders/${order.id}/report`}
                download
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80"
                style={{ background: GOLD, color: '#0A0805' }}
              >
                ↓ Download Report
              </a>
            )}
          </div>
          <CustomerInternalOrderCodeField
            orderId={order.id}
            initialValue={order.customerInternalOrderCode}
          />
        </div>

        <SfsProductionTracker
          stages={tracker}
          invoicingStatus={billing.invoicingStatus}
          collectionStatus={billing.collectionStatus}
          tone="client"
        />

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

        {order.quotedAmount != null && (
          <div
            className="rounded-2xl p-5 space-y-2"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#3b82f6' }}>
              Quotation
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: DARK }}>
              HK${Number(order.quotedAmount).toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </p>
            {order.quotedAt && (
              <p className="text-xs" style={{ color: MUTED }}>
                Issued {new Date(order.quotedAt).toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {order.quoteNotes && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: DARK }}>
                {order.quoteNotes}
              </p>
            )}
            <QuoteResponseActions
              orderId={order.id}
              status={order.status}
              quotedAmount={order.quotedAmount == null ? null : Number(order.quotedAmount)}
            />
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
                    {group.steps.map(step => {
                      const notes = splitSfsStepNotes(step.notes)
                      const usesDiamondFiles = sfsStepRequiresDiamondImages(
                        step.phase,
                        step.stepNumber,
                        step.defaultKey,
                      )
                      const visibleFileKeys = sfsCustomerVisibleStepFileKeys(step)
                      const grouped = usesDiamondFiles ? groupSfsStepFilesByDiamond(visibleFileKeys, diamonds) : null
                      const stepName = step.displayName || step.particular

                      return (
                        <div key={step.id} className="px-5 py-4 flex items-start gap-3" style={{ borderColor: BORDER }}>
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                            >
                              ✓
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                <p className="text-sm font-medium" style={{ color: DARK }}>{stepName}</p>
                                <p className="text-xs" style={{ color: MUTED }}>
                                  {new Date(step.recordedAt).toLocaleString('en-HK', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              {notes.weight && (
                                <p className="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'rgba(201,169,110,0.1)', color: GOLD }}>
                                  Weight: {notes.weight}
                                </p>
                              )}
                              {notes.remark && (
                                <p className="text-xs mt-1 italic whitespace-pre-wrap" style={{ color: MUTED }}>{notes.remark}</p>
                              )}
                              {grouped ? (
                                <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, diamonds.length)}, minmax(0, 1fr))` }}>
                                  {grouped.groups.map(group => (
                                    <div key={group.label} className="min-w-0 rounded-xl p-2" style={{ background: 'rgba(201,169,110,0.04)', border: `1px solid ${BORDER}` }}>
                                      <p className="mb-2 truncate text-center text-[10px] font-mono font-semibold" style={{ color: GOLD }}>{group.label}</p>
                                      <div className="flex flex-wrap justify-center gap-2">
                                        {group.fileKeys.length > 0 ? (
                                          group.fileKeys.map(key => (
                                            <StepFilePreview key={key} fileKey={key} label={group.label} borderColor={BORDER} gold={GOLD} />
                                          ))
                                        ) : (
                                          <span className="py-6 text-xs" style={{ color: MUTED }}>No image</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {grouped.unmatched.map(key => (
                                    <StepFilePreview key={key} fileKey={key} label={sfsStepFileDiamondLabel(key)} borderColor={BORDER} gold={GOLD} />
                                  ))}
                                </div>
                              ) : visibleFileKeys.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {visibleFileKeys.map(key => (
                                    <StepFilePreview key={key} fileKey={key} label={sfsStepFileDiamondLabel(key)} borderColor={BORDER} gold={GOLD} />
                                  ))}
                                </div>
                              )}
                            </div>
                        </div>
                      )
                    })}
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
