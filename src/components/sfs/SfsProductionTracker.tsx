import type { ProjectCollectionStatus, ProjectInvoicingStatus } from '@/lib/adviser/project-labels'
import type { SfsTrackerStage } from '@/lib/sfs/order-tracker'

const INVOICING_LABEL: Record<ProjectInvoicingStatus, string> = {
  NOT_INVOICED: 'Not invoiced',
  PARTIAL: 'Partly invoiced',
  INVOICED: 'Invoiced',
}

const COLLECTION_LABEL: Record<ProjectCollectionStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partly paid',
  PAID: 'Paid',
}

function formatWhen(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SfsProductionTracker({
  stages,
  invoicingStatus,
  collectionStatus,
  deliveryWarning,
  tone = 'admin',
}: {
  stages: SfsTrackerStage[]
  invoicingStatus: ProjectInvoicingStatus
  collectionStatus: ProjectCollectionStatus
  deliveryWarning?: string | null
  tone?: 'admin' | 'client'
}) {
  const client = tone === 'client'
  const card = client ? '#FFFFFF' : 'var(--card)'
  const border = client ? '#EDE7D8' : 'var(--border)'
  const text = client ? '#1A1A1A' : 'var(--foreground)'
  const muted = client ? '#6B5E4A' : 'var(--muted-foreground)'
  const gold = '#C9A96E'
  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: card, border: `1px solid ${border}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: gold }}>Production</h2>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(201,169,110,0.12)', color: gold }}>
            {INVOICING_LABEL[invoicingStatus]}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs"
            style={{
              background: collectionStatus === 'PAID' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: collectionStatus === 'PAID' ? '#10b981' : '#ef4444',
            }}
          >
            {COLLECTION_LABEL[collectionStatus]}
          </span>
        </div>
      </div>
      <ol className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {stages.map((stage, index) => {
          const done = stage.state === 'done'
          const current = stage.state === 'current'
          return (
            <li key={stage.key} className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{
                    background: done ? '#C9A96E' : 'transparent',
                    color: done ? '#0A0805' : current ? gold : muted,
                    border: `1.5px solid ${done || current ? gold : border}`,
                  }}
                >
                  {index + 1}
                </span>
                {index < stages.length - 1 ? (
                  <span className="hidden lg:block h-px flex-1" style={{ background: done ? gold : border }} />
                ) : null}
              </div>
              <p className="mt-2 text-xs font-medium leading-snug" style={{ color: current || done ? text : muted }}>
                {stage.label}
              </p>
              {formatWhen(stage.at) ? (
                <p className="mt-0.5 text-[11px]" style={{ color: muted }}>{formatWhen(stage.at)}</p>
              ) : null}
            </li>
          )
        })}
      </ol>
      {deliveryWarning ? (
        <p className="text-xs" style={{ color: '#f59e0b' }}>{deliveryWarning}</p>
      ) : null}
    </div>
  )
}
