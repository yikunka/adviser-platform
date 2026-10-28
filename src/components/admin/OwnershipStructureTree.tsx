'use client'

import { COMPANY_JURISDICTION_LABELS, type CompanyJurisdiction } from '@/lib/company/jurisdiction'

export type OwnershipNode = {
  id: string
  type: 'COMPANY' | 'PERSON'
  nameEn: string
  nameZh: string | null
  companyId: string | null
  companyNumber: string | null
  companyType: string | null
  keyPersonId: string | null
  shareClass: string | null
  sharesHeld: number | null
  ownershipPercent: number | null
  circular: boolean
  children: OwnershipNode[]
}

const LINE = '#3D3428'

function OwnershipLeafCard({ node }: { node: OwnershipNode }) {
  const isCompany = node.type === 'COMPANY'
  const hasMeta = node.sharesHeld != null || node.ownershipPercent != null || node.shareClass
  const jurisdictionLabel = node.companyType
    ? (COMPANY_JURISDICTION_LABELS[node.companyType as CompanyJurisdiction] ?? node.companyType)
    : null

  return (
    <div
      className="min-w-[10.5rem] max-w-[14rem] rounded-lg border px-3 py-2.5 text-center shadow-sm"
      style={{
        borderColor: isCompany ? '#38bdf866' : '#C9A96E55',
        background: isCompany ? 'rgba(56,189,248,0.10)' : 'rgba(201,169,110,0.10)',
      }}
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: isCompany ? 'rgba(56,189,248,0.16)' : 'rgba(201,169,110,0.16)',
            color: isCompany ? '#38bdf8' : '#C9A96E',
          }}
        >
          {isCompany ? 'Company' : 'Shareholder'}
        </span>
        {node.circular ? (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
          >
            Circular
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>
        {node.nameEn}
      </p>
      {node.nameZh ? (
        <p className="mt-0.5 text-[11px] leading-snug" style={{ color: '#7A7060' }}>{node.nameZh}</p>
      ) : null}
      {jurisdictionLabel ? (
        <p className="mt-0.5 text-[11px]" style={{ color: '#7A7060' }}>{jurisdictionLabel}</p>
      ) : null}
      {node.companyNumber ? (
        <p className="mt-0.5 text-[11px]" style={{ color: '#7A7060' }}>Co. No. {node.companyNumber}</p>
      ) : null}
      {hasMeta ? (
        <div className="mt-1.5 space-y-0.5 text-[11px]" style={{ color: 'var(--text-dim)' }}>
          {node.ownershipPercent != null ? (
            <p className="font-semibold" style={{ color: 'var(--text-cream)' }}>
              {Number(node.ownershipPercent.toFixed(4))}%
            </p>
          ) : null}
          {node.sharesHeld != null ? <p>{node.sharesHeld.toLocaleString()} shares</p> : null}
          {node.shareClass ? <p>{node.shareClass}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function OwnershipTreeNode({ node }: { node: OwnershipNode }) {
  const owners = node.children.filter(
    child => (child.sharesHeld ?? 0) > 0 && child.ownershipPercent !== 0,
  )
  if (node.type !== 'COMPANY' || owners.length === 0) {
    return <OwnershipLeafCard node={node} />
  }

  return (
    <div className="inline-flex flex-col items-center">
      {/*
        Card row uses items-end so nested look-through grows upward and every
        direct owner of `node` sits on one horizontal band (peer alignment).
      */}
      <div className="flex items-end justify-center">
        {owners.map((child, index) => (
          <div
            key={`${child.type}-${child.id}-${index}`}
            className="flex flex-col items-center px-3"
          >
            <OwnershipTreeNode node={child} />
          </div>
        ))}
      </div>

      {/* Connector bus sits under the aligned owner cards */}
      <div className="flex w-full justify-center">
        {owners.map((child, index) => (
          <div
            key={`edge-${child.type}-${child.id}-${index}`}
            className="flex min-w-[2rem] flex-1 flex-col items-center px-3"
          >
            <div className="h-4 w-px shrink-0" style={{ background: LINE }} />
            {owners.length > 1 ? (
              <div className="flex h-px w-full">
                <div
                  className="h-px flex-1"
                  style={{ background: index === 0 ? 'transparent' : LINE }}
                />
                <div
                  className="h-px flex-1"
                  style={{ background: index === owners.length - 1 ? 'transparent' : LINE }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="h-4 w-px shrink-0" style={{ background: LINE }} />
      <OwnershipLeafCard node={node} />
    </div>
  )
}

export function OwnershipStructurePanel({
  structure,
  loading,
}: {
  structure: OwnershipNode | null
  loading: boolean
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          Company Ownership Structure
        </h3>
        <p className="mt-1 text-xs" style={{ color: '#7A7060' }}>
          樹形圖：股東在上、公司在下。公司股東若名稱對應系統內其他公司，會繼續向上展開其股東。
        </p>
      </div>
      <div
        className="overflow-x-auto p-4"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
        }}
      >
        {loading ? (
          <p className="text-sm" style={{ color: '#7A7060' }}>Loading ownership structure...</p>
        ) : structure ? (
          <div className="flex min-w-min justify-center py-2">
            <OwnershipTreeNode node={structure} />
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#5A5040' }}>No ownership structure available.</p>
        )}
      </div>
    </div>
  )
}
