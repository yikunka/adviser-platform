'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ClipboardList, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react'
import { formatWeight } from '@/lib/cosmocoat/recipes'

type ProductionOrderRow = {
  id: string
  code: string
  totalWeight: number
  batchNo: string
  status: string
  createdAt: string
  factoryProduct: { productCode: string; name: string; unit: string }
  recipe: { code: string; name: string; shelfLifeDays: number | null }
  items: Array<{ requiredWeight: number }>
  requiredTotal: number
  productionRequirements?: string
  qualityCheckRequirements?: string
  packagingRequirements?: string
}

type ProductLabelDraft = {
  order: ProductionOrderRow
  productName: string
  weight: string
}

type ProductLabelPrintData = {
  productName: string
  orderCode: string
  recipeCode: string
  shelfLife: string
  weight: string
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontWeight: 500,
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  background: '#111108',
  borderBottom: '1px solid #2A2418',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: 'var(--muted-foreground)',
  borderBottom: '1px solid #1E1C15',
}

function inputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function statusLabel(status: string) {
  return status === 'completed' ? '已完成' : '草稿'
}

function formatShelfLife(days: number | null | undefined) {
  return days ? `${days} 天` : '—'
}

function ProductLabelPrintView({ label }: { label: ProductLabelPrintData }) {
  return (
    <div id="cosmocoat-product-label-print-area">
      <div className="product-label-card">
        <div className="product-label-title">产品标签</div>
        <div className="product-label-product">{label.productName || '—'}</div>
        <div className="product-label-grid">
          <span>生产单号</span>
          <strong>{label.orderCode || '—'}</strong>
          <span>配方号</span>
          <strong>{label.recipeCode || '—'}</strong>
          <span>保质期</span>
          <strong>{label.shelfLife}</strong>
          <span>重量</span>
          <strong>{label.weight || '—'}</strong>
        </div>
      </div>
    </div>
  )
}

export default function AdminCosmoCoatProductionOrdersPage() {
  const router = useRouter()
  const [items, setItems] = useState<ProductionOrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState<ProductLabelDraft | null>(null)
  const [labelPrintData, setLabelPrintData] = useState<ProductLabelPrintData | null>(null)
  const [printingLabel, setPrintingLabel] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/cosmocoat/production-orders?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const t = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchItems, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  async function deleteOrder(order: ProductionOrderRow) {
    if (!window.confirm(`确定删除生产单「${order.code}」？`)) return
    setDeletingId(order.id)
    try {
      const res = await fetch(`/api/admin/cosmocoat/production-orders/${order.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '删除失败')
        return
      }
      toast.success('已删除')
      fetchItems()
    } catch {
      toast.error('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    function clearPrintedLabel() {
      setPrintingLabel(false)
      setLabelPrintData(null)
    }

    window.addEventListener('afterprint', clearPrintedLabel)
    return () => window.removeEventListener('afterprint', clearPrintedLabel)
  }, [])

  function openLabelDialog(order: ProductionOrderRow) {
    setLabelDraft({
      order,
      productName: order.factoryProduct.name,
      weight: `${formatWeight(order.totalWeight)} ${order.factoryProduct.unit}`,
    })
  }

  function printProductLabel() {
    if (!labelDraft) return
    const nextLabel = {
      productName: labelDraft.productName.trim(),
      orderCode: labelDraft.order.code,
      recipeCode: labelDraft.order.recipe.code,
      shelfLife: formatShelfLife(labelDraft.order.recipe.shelfLifeDays),
      weight: labelDraft.weight.trim(),
    }
    setLabelPrintData(nextLabel)
    setLabelDraft(null)
    setPrintingLabel(true)
    window.setTimeout(() => window.print(), 50)
  }

  return (
    <>
      {labelPrintData && (
        <>
          <style>{`
            @media print {
              @page { size: 100mm 70mm; margin: 0; }

              html,
              body {
                width: 100mm !important;
                height: 70mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
              }

              .admin-console {
                display: block !important;
                min-height: auto !important;
                background: #fff !important;
              }

              .admin-console > aside,
              .admin-console > .flex-1 > header,
              .feedback-widget,
              .cosmocoat-production-orders-screen {
                display: none !important;
              }

              .admin-console > .flex-1,
              .admin-console main {
                display: block !important;
                min-width: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: #fff !important;
              }

              #cosmocoat-product-label-print-area {
                display: block !important;
                width: 100mm;
                height: 70mm;
                padding: 4mm;
                box-sizing: border-box;
                font-family: 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
                color: #111 !important;
                background: #fff !important;
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }

              #cosmocoat-product-label-print-area * {
                box-sizing: border-box;
                color: #111 !important;
              }

              .product-label-card {
                width: 100%;
                height: 100%;
                border: 1.6pt solid #111;
                padding: 4mm;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                gap: 2.5mm;
              }

              .product-label-title {
                text-align: center;
                font-size: 12pt;
                font-weight: 700;
                letter-spacing: 0;
                border-bottom: 1pt solid #111;
                padding-bottom: 2mm;
              }

              .product-label-product {
                min-height: 12mm;
                font-size: 13pt;
                font-weight: 700;
                line-height: 1.2;
                word-break: break-word;
                overflow-wrap: anywhere;
              }

              .product-label-grid {
                display: grid;
                grid-template-columns: 22mm 1fr;
                border-top: 1pt solid #111;
                border-left: 1pt solid #111;
                font-size: 10pt;
                line-height: 1.25;
              }

              .product-label-grid span,
              .product-label-grid strong {
                min-height: 8mm;
                padding: 1.6mm 2mm;
                border-right: 1pt solid #111;
                border-bottom: 1pt solid #111;
                word-break: break-word;
                overflow-wrap: anywhere;
              }

              .product-label-grid span {
                font-weight: 700;
                background: #f1f1f1 !important;
              }
            }

            @media screen {
              #cosmocoat-product-label-print-area { display: none; }
            }
          `}</style>
          <ProductLabelPrintView label={labelPrintData} />
        </>
      )}
      <div className="cosmocoat-production-orders-screen p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>CosmoCoat 生产单管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            选择产品与生产总量，基于当前配方自动计算各原料参考投料量。
          </p>
        </div>
        <Link
          href="/admin/cosmocoat-production-orders/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#C9A96E', color: '#0A0805' }}
        >
          <Plus size={15} /> 新建生产单
        </Link>
      </div>

      <div style={card} className="p-4">
        <div className="relative max-w-md">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索生产单号、批次、产品、配方..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle()}
          />
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <ClipboardList size={32} className="mx-auto" style={{ color: '#5A5040' }} />
            <p className="text-sm" style={{ color: '#5A5040' }}>暂无生产单，点击「新建生产单」开始。</p>
            <Link href="/admin/cosmocoat-production-orders/new" className="inline-flex px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#C9A96E', color: '#0A0805' }}>
              新建生产单
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>生产单号</th>
                  <th style={th}>产品</th>
                  <th style={th}>配方</th>
                  <th style={th}>生产重量</th>
                  <th style={th}>参考投料合计</th>
                  <th style={th}>批次</th>
                  <th style={th}>状态</th>
                  <th style={th}>创建时间</th>
                  <th style={{ ...th, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(order => (
                  <tr
                    key={order.id}
                    className="cursor-pointer transition-colors hover:bg-[#111108]"
                    onClick={() => router.push(`/admin/cosmocoat-production-orders/${order.id}`)}
                  >
                    <td style={{ ...td, color: 'var(--foreground)', fontWeight: 500 }}>{order.code}</td>
                    <td style={td}>
                      <span className="font-mono text-xs mr-1.5 opacity-70">{order.factoryProduct.productCode}</span>
                      {order.factoryProduct.name}
                    </td>
                    <td style={td}>
                      <span className="font-mono text-xs mr-1.5 opacity-70">{order.recipe.code}</span>
                      {order.recipe.name}
                    </td>
                    <td style={td}>{formatWeight(order.totalWeight)} {order.factoryProduct.unit}</td>
                    <td style={td}>{formatWeight(order.requiredTotal)} {order.factoryProduct.unit}</td>
                    <td style={td}>{order.batchNo || '—'}</td>
                    <td style={td}>{statusLabel(order.status)}</td>
                    <td style={td}>{new Date(order.createdAt).toLocaleDateString('zh-CN')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/cosmocoat-production-orders/${order.id}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-md inline-flex"
                          title="修改生产单"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); openLabelDialog(order) }}
                          className="p-1.5 rounded-md disabled:opacity-40"
                          title="打印产品标签"
                          disabled={printingLabel}
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); deleteOrder(order) }}
                          disabled={deletingId === order.id}
                          className="p-1.5 rounded-md disabled:opacity-40"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: '#5A5040' }}>
          <span>共 {total} 条生产单</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>上一页</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-md disabled:opacity-40" style={{ border: '1px solid #2A2418' }}>下一页</button>
          </div>
        </div>
      )}
      {labelDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0, 0, 0, 0.55)' }}
          onClick={() => setLabelDraft(null)}
        >
          <div
            className="w-full max-w-md rounded-lg p-5 shadow-xl"
            style={{ ...card, background: '#0A0805' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>打印产品标签</h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {labelDraft.order.code} · {labelDraft.order.recipe.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLabelDraft(null)}
                className="rounded-md p-1.5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>产品名称</label>
                <input
                  value={labelDraft.productName}
                  onChange={e => setLabelDraft(prev => prev ? { ...prev, productName: e.target.value } : prev)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产单号</label>
                  <input
                    value={labelDraft.order.code}
                    readOnly
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70"
                    style={inputStyle()}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方号</label>
                  <input
                    value={labelDraft.order.recipe.code}
                    readOnly
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70"
                    style={inputStyle()}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>保质期</label>
                  <input
                    value={formatShelfLife(labelDraft.order.recipe.shelfLifeDays)}
                    readOnly
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70"
                    style={inputStyle()}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>重量</label>
                  <input
                    value={labelDraft.weight}
                    onChange={e => setLabelDraft(prev => prev ? { ...prev, weight: e.target.value } : prev)}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                    style={inputStyle()}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLabelDraft(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={printProductLabel}
                disabled={printingLabel}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: '#C9A96E', color: '#0A0805' }}
              >
                <Printer size={14} /> {printingLabel ? '准备中...' : '打印标签'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  )
}
