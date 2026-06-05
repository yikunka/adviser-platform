'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, FlaskConical, Printer, Save } from 'lucide-react'
import {
  buildProductionOrderItems,
  formatPercent,
  formatWeight,
  productionOrderItemKey,
  recipeItemsForProduction,
  type ProductionRecipeItem,
  formatProductionRequirements,
  formatRecipeQcRequirements,
} from '@/lib/cosmocoat/recipes'
import { DatetimeLocalPicker } from '@/components/ui/date-picker-popover'
import { FactoryProductCombobox } from '@/components/cosmocoat/FactoryProductCombobox'
import type { FactoryProductPickerOption } from '@/lib/cosmocoat/factory-product-picker'

type FactoryProductOption = FactoryProductPickerOption

type EditableItem = {
  key: string
  id?: string
  itemType: 'raw_material' | 'product_semifinished'
  rawMaterialId?: string
  productSemifinishedId?: string
  sortOrder: number
  productionCode: string
  materialName: string
  percentage: number
  requiredWeight: number
  actualWeight: number | null
  notes: string
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.6rem 0.75rem',
  fontWeight: 500,
  fontSize: '0.8125rem',
  color: 'var(--muted-foreground)',
  background: '#111108',
  borderBottom: '1px solid #2A2418',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  fontSize: '0.8125rem',
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

const dateTimePickerStyle: React.CSSProperties = {
  background: '#0E0E0A',
  border: '1px solid #2A2418',
  color: 'var(--foreground)',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function formatDatetime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = { draft: '草稿', completed: '已完成' }

interface PrintViewProps {
  code: string
  productName: string
  recipeCode: string
  recipeName: string
  totalWeight: number
  productUnit: string
  batchNo: string
  startedAt: string
  finishedAt: string
  status: string
  items: EditableItem[]
  productionNotes: string
  qualityNotes: string
  packagingNotes: string
}

function PrintView({
  code, productName, recipeCode, recipeName, totalWeight, productUnit,
  batchNo, startedAt, finishedAt, status, items,
  productionNotes, qualityNotes, packagingNotes,
}: PrintViewProps) {
  return (
    <div id="cosmocoat-print-area">
      {/* ─── Basic info grid ─── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 9 }}>
        <tbody>
          <tr>
            <td style={{ width: '15%', padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>生产单号</td>
            <td style={{ width: '35%', padding: '3px 6px', border: '1px solid #ccc' }}>{code || '（草稿）'}</td>
            <td style={{ width: '15%', padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>生产批次</td>
            <td style={{ width: '35%', padding: '3px 6px', border: '1px solid #ccc' }}>{batchNo || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>产品名称</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{productName || '—'}</td>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>生产重量</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{totalWeight} {productUnit}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>配方编号</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{recipeCode || '—'}</td>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>配方名称</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{recipeName || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>开始时间</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{formatDatetime(startedAt)}</td>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>完成时间</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{formatDatetime(finishedAt)}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>状态</td>
            <td colSpan={3} style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{STATUS_LABEL[status] ?? status}</td>
          </tr>
        </tbody>
      </table>

      {/* ─── Materials table ─── */}
      <div className="print-section-title" style={{ fontWeight: 700, fontSize: 10, marginBottom: 4, borderLeft: '3px solid #000', paddingLeft: 6 }}>
        原料投料明细
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 9 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'center', width: '8%' }}>序号</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'left', width: '34%' }}>物料编号</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'right', width: '14%' }}>比例</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'right', width: '22%' }}>参考投料 ({productUnit})</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'right', width: '22%' }}>实投 ({productUnit})</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.key} style={{ background: index % 2 === 1 ? '#fafafa' : '#fff' }}>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'center' }}>{index + 1}</td>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{item.productionCode}</td>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>{formatPercent(item.percentage)}</td>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>{formatWeight(item.requiredWeight)}</td>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>
                {item.actualWeight != null ? formatWeight(item.actualWeight) : ''}
              </td>
            </tr>
          ))}
          {/* Totals row */}
          <tr style={{ background: '#f0f0f0', fontWeight: 700 }}>
            <td colSpan={3} style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>合计</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>
              {formatWeight(items.reduce((s, i) => s + i.requiredWeight, 0))}
            </td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>
              {items.some(i => i.actualWeight != null)
                ? formatWeight(items.reduce((s, i) => s + (i.actualWeight ?? 0), 0))
                : ''}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ─── Notes sections ─── */}
      {(productionNotes || qualityNotes || packagingNotes) && (
        <table className="print-notes-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'left', width: '33%' }}>生产要求</th>
              <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'left', width: '34%' }}>生产注意事项（含质检）</th>
              <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'left', width: '33%' }}>包装要求</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '5px 6px', border: '1px solid #ccc', verticalAlign: 'top', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{productionNotes}</td>
              <td style={{ padding: '5px 6px', border: '1px solid #ccc', verticalAlign: 'top', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{qualityNotes}</td>
              <td style={{ padding: '5px 6px', border: '1px solid #ccc', verticalAlign: 'top', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{packagingNotes}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* ─── Signature row ─── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 9 }}>
        <tbody>
          <tr>
            {['生产人员', '质检人员', '仓库确认'].map(label => (
              <td key={label} className="signature-cell" style={{ padding: '12px 8px 4px', border: '1px solid #ccc', textAlign: 'center', width: '33%' }}>
                <div>{label}</div>
                <div style={{ borderBottom: '1px solid #999', marginTop: 16 }} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function AdminCosmoCoatProductionOrderEditorPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = params.id as string
  const isNew = orderId === 'new'
  const filterRecipeId = isNew ? (searchParams.get('recipeId')?.trim() || null) : null

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)

  function handlePrint() {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 100)
  }
  const [selectedProductSnapshot, setSelectedProductSnapshot] = useState<FactoryProductOption | null>(null)
  const [recipeItems, setRecipeItems] = useState<ProductionRecipeItem[]>([])

  const [code, setCode] = useState('')
  const [factoryProductId, setFactoryProductId] = useState('')
  const [recipeCode, setRecipeCode] = useState('')
  const [recipeName, setRecipeName] = useState('')
  const [productName, setProductName] = useState('')
  const [productUnit, setProductUnit] = useState('kg')
  const [totalWeight, setTotalWeight] = useState(100)
  const [batchNo, setBatchNo] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [finishedAt, setFinishedAt] = useState('')
  const [productionNotes, setProductionNotes] = useState('')
  const [qualityNotes, setQualityNotes] = useState('')
  const [packagingNotes, setPackagingNotes] = useState('')
  const [status, setStatus] = useState<'draft' | 'completed'>('draft')
  const [items, setItems] = useState<EditableItem[]>([])

  const selectedProduct = selectedProductSnapshot

  const requiredTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.requiredWeight, 0),
    [items],
  )

  const loadRecipeItems = useCallback(async (recipeId: string) => {
    try {
      const res = await fetch(`/api/admin/cosmocoat/recipes/${recipeId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载配方失败')
        setRecipeItems([])
        return
      }
      const recipe = data.recipe
      setRecipeCode(recipe.code)
      setRecipeName(recipe.name)
      if (isNew) {
        setProductionNotes(formatProductionRequirements(
          recipe.productionSpeedRequirements ?? '',
          recipe.productionTimeRequirements ?? '',
        ))
        setQualityNotes(formatRecipeQcRequirements(
          recipe.qcTestStandard ?? '',
          recipe.qcResult ?? '',
          {
            qcTestItems: recipe.qcTestItems ?? [],
            viscosity: recipe.viscosity,
            viscosityUnit: recipe.viscosityUnit,
          },
        ))
        setPackagingNotes(recipe.packagingRequirements ?? '')
      }
      const productionItems = recipeItemsForProduction(recipe.items)
      if (productionItems.length === 0) {
        toast.error('当前配方无可投料明细，无法生成投料表')
      }
      setRecipeItems(productionItems)
    } catch {
      toast.error('加载配方失败')
      setRecipeItems([])
    }
  }, [isNew])

  const loadOrder = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/production-orders/${orderId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载生产单失败')
        return
      }
      const order = data.order
      setCode(order.code)
      setFactoryProductId(order.factoryProductId)
      setProductName(order.factoryProduct.name)
      setProductUnit(order.factoryProduct.unit)
      setRecipeCode(order.recipe.code)
      setRecipeName(order.recipe.name)
      setTotalWeight(order.totalWeight)
      setBatchNo(order.batchNo)
      setStartedAt(toDatetimeLocal(order.startedAt))
      setFinishedAt(toDatetimeLocal(order.finishedAt))
      setProductionNotes(order.productionNotes || order.productionRequirements)
      setQualityNotes(order.qualityNotes || order.qualityCheckRequirements)
      setPackagingNotes(order.packagingNotes || order.packagingRequirements)
      setStatus(order.status === 'completed' ? 'completed' : 'draft')
      setItems(order.items.map((item: {
        id: string
        itemType?: 'raw_material' | 'product_semifinished'
        sortOrder: number
        productionCode: string
        materialName: string
        percentage: number
        requiredWeight: number
        actualWeight: number | null
        notes: string
        rawMaterial: { id: string } | null
        productSemifinished: { id: string } | null
      }) => ({
        key: item.id,
        id: item.id,
        itemType: item.itemType ?? (item.productSemifinished ? 'product_semifinished' : 'raw_material'),
        rawMaterialId: item.rawMaterial?.id,
        productSemifinishedId: item.productSemifinished?.id,
        sortOrder: item.sortOrder,
        productionCode: item.productionCode,
        materialName: item.materialName,
        percentage: item.percentage,
        requiredWeight: item.requiredWeight,
        actualWeight: item.actualWeight,
        notes: item.notes,
      })))
    } catch {
      toast.error('加载生产单失败')
    } finally {
      setLoading(false)
    }
  }, [orderId, isNew])

  useEffect(() => {
    if (isNew) setLoading(false)
  }, [isNew])

  useEffect(() => {
    if (!isNew) loadOrder()
  }, [isNew, loadOrder])

  useEffect(() => {
    if (!isNew || !factoryProductId) return
    const product = selectedProductSnapshot
    if (!product || product.id !== factoryProductId) return
    setProductName(product.name)
    setProductUnit(product.unit)
    if (!product.currentRecipe) {
      setRecipeCode('')
      setRecipeName('')
      setRecipeItems([])
      toast.error('该产品未设置当前配方')
      return
    }
    loadRecipeItems(product.currentRecipe.id)
  }, [factoryProductId, selectedProductSnapshot, isNew, loadRecipeItems])

  function handleProductSelect(product: FactoryProductPickerOption | null) {
    setSelectedProductSnapshot(product)
  }

  useEffect(() => {
    if (isNew) {
      setBatchNo(code)
    }
  }, [code, isNew])

  useEffect(() => {
    if (!isNew || recipeItems.length === 0 || totalWeight <= 0) {
      if (isNew && recipeItems.length === 0) setItems([])
      return
    }
    setItems(prev => {
      const actualByKey = new Map(prev.map(item => [item.key, item.actualWeight]))
      return buildProductionOrderItems(recipeItems, totalWeight).map(item => {
        const key = productionOrderItemKey(item)
        return {
          key,
          itemType: item.itemType,
          rawMaterialId: item.rawMaterialId,
          productSemifinishedId: item.productSemifinishedId,
          sortOrder: item.sortOrder,
          productionCode: item.productionCode,
          materialName: item.materialName,
          percentage: item.percentage,
          requiredWeight: item.requiredWeight,
          actualWeight: actualByKey.get(key) ?? null,
          notes: item.notes,
        }
      })
    })
  }, [isNew, recipeItems, totalWeight])

  useEffect(() => {
    if (isNew) return
    setItems(prev => prev.map(item => ({
      ...item,
      requiredWeight: totalWeight > 0 ? (totalWeight * item.percentage) / 100 : 0,
    })))
  }, [isNew, totalWeight])

  function patchActualWeight(key: string, actualWeight: number | null) {
    setItems(prev => prev.map(item => (
      item.key === key ? { ...item, actualWeight } : item
    )))
  }

  async function saveOrder() {
    if (isNew && !factoryProductId) {
      toast.error('请选择产品')
      return
    }
    if (totalWeight <= 0) {
      toast.error('请填写有效的生产重量')
      return
    }
    if (isNew && items.length === 0) {
      toast.error('当前配方无可投料明细，无法创建生产单')
      return
    }

    setSaving(true)
    const itemPayload = items.map(item => ({
      ...(item.itemType === 'product_semifinished'
        ? { productSemifinishedId: item.productSemifinishedId }
        : { rawMaterialId: item.rawMaterialId }),
      actualWeight: item.actualWeight,
      notes: item.notes,
    }))
    const payload = isNew
      ? {
          code: code.trim() || undefined,
          factoryProductId,
          totalWeight,
          batchNo,
          startedAt: fromDatetimeLocal(startedAt),
          finishedAt: fromDatetimeLocal(finishedAt),
          productionNotes,
          qualityNotes,
          packagingNotes,
          status,
          items: itemPayload,
        }
      : {
          totalWeight,
          batchNo,
          startedAt: fromDatetimeLocal(startedAt),
          finishedAt: fromDatetimeLocal(finishedAt),
          productionNotes,
          qualityNotes,
          packagingNotes,
          status,
          items: items.map(item => ({
            id: item.id,
            actualWeight: item.actualWeight,
            notes: item.notes,
          })),
        }

    try {
      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/production-orders' : `/api/admin/cosmocoat/production-orders/${orderId}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }
      toast.success(isNew ? '生产单已创建' : '生产单已保存')
      if (isNew && data.order?.id) {
        router.replace(`/admin/cosmocoat-production-orders/${data.order.id}`)
      } else {
        loadOrder()
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
  }

  return (
    <>
      {/* ─── Print styles ─── */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }

          html,
          body {
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
          .cosmocoat-screen { display: none !important; }

          .admin-console > .flex-1 {
            display: block !important;
            min-width: 0 !important;
          }

          .admin-console main {
            display: block !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }

          #cosmocoat-print-area {
            display: block !important;
            width: auto;
            max-width: none;
            box-sizing: border-box;
            padding: 12mm 14mm;
            font-family: 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.45;
            color: #000 !important;
            background: #fff !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          /* Prevent any child from exceeding the page width */
          #cosmocoat-print-area * {
            box-sizing: border-box;
            max-width: 100%;
          }

          /* Tables: fixed layout so columns don't overflow */
          #cosmocoat-print-area table {
            table-layout: fixed;
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt !important;
          }

          /* Cells: wrap long text */
          #cosmocoat-print-area td,
          #cosmocoat-print-area th {
            word-break: break-all;
            overflow-wrap: break-word;
            overflow: hidden;
            padding: 4px 6px !important;
            font-size: 10pt !important;
            line-height: 1.4;
          }

          #cosmocoat-print-area .print-notes-table td {
            white-space: pre-wrap;
          }

          #cosmocoat-print-area .print-section-title {
            font-size: 12pt !important;
            margin-bottom: 6px !important;
          }

          #cosmocoat-print-area .signature-cell {
            padding: 18px 10px 6px !important;
          }
        }

        @media screen {
          #cosmocoat-print-area { display: none; }
        }
      `}</style>

      {/* ─── Print view (hidden on screen, shown when printing) ─── */}
      <PrintView
        code={code}
        productName={productName}
        recipeCode={recipeCode}
        recipeName={recipeName}
        totalWeight={totalWeight}
        productUnit={productUnit}
        batchNo={batchNo}
        startedAt={startedAt}
        finishedAt={finishedAt}
        status={status}
        items={items}
        productionNotes={productionNotes}
        qualityNotes={qualityNotes}
        packagingNotes={packagingNotes}
      />

      {/* ─── Screen UI wrapper (hidden during print) ─── */}
      <div className="cosmocoat-screen">
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-production-orders" className="p-2 rounded-lg" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? '新建生产单' : '生产单详情'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {isNew ? '选择产品并填写生产总量与实投数量，保存后生效' : `${code} · ${productName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button type="button" onClick={handlePrint} disabled={printing} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}>
              <Printer size={14} /> {printing ? '准备中...' : '打印'}
            </button>
          )}
          <button type="button" onClick={saveOrder} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: '#C9A96E', color: '#0A0805' }}>
            <Save size={14} /> {saving ? '保存中...' : (isNew ? '创建' : '保存')}
          </button>
        </div>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>基本信息</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {isNew ? (
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>选择产品</label>
              <FactoryProductCombobox
                value={factoryProductId}
                onChange={setFactoryProductId}
                onProductSelect={handleProductSelect}
                recipeId={filterRecipeId}
                inputStyle={inputStyle()}
                placeholder="搜索产品编号、名称或配方..."
              />
              {filterRecipeId && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  已按当前配方筛选，仅显示关联该配方且有当前配方的工厂产品
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产单号</label>
              <input value={code} readOnly className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70" style={inputStyle()} />
            </div>
          )}
          {!isNew && (
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>产品名称</label>
              <input value={productName} readOnly className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70" style={inputStyle()} />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方编号</label>
            <input value={recipeCode} readOnly className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70" style={inputStyle()} placeholder="选择产品后自动带出" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方名称</label>
            <input value={recipeName} readOnly className="w-full rounded-lg px-3 py-2.5 text-sm outline-none opacity-70" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产重量 ({productUnit})</label>
            <input type="number" min={0.001} step="0.001" value={totalWeight} onChange={e => setTotalWeight(Number(e.target.value) || 0)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产批次</label>
            <input value={batchNo} onChange={e => setBatchNo(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>开始时间</label>
            <DatetimeLocalPicker
              value={startedAt}
              onChange={setStartedAt}
              datePlaceholder="选择日期"
              dateTriggerStyle={{ ...dateTimePickerStyle, width: '100%', padding: '0.625rem 0.75rem' }}
              timeInputStyle={dateTimePickerStyle}
              timeInputClassName="outline-none"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>完成时间</label>
            <DatetimeLocalPicker
              value={finishedAt}
              onChange={setFinishedAt}
              datePlaceholder="选择日期"
              dateTriggerStyle={{ ...dateTimePickerStyle, width: '100%', padding: '0.625rem 0.75rem' }}
              timeInputStyle={dateTimePickerStyle}
              timeInputClassName="outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>状态</label>
            <select value={status} onChange={e => setStatus(e.target.value as 'draft' | 'completed')} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()}>
              <option value="draft">草稿</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          {isNew && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产单号（可选）</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="留空则自动生成" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span style={{ color: 'var(--muted-foreground)' }}>参考投料合计：<strong style={{ color: '#C9A96E' }}>{formatWeight(requiredTotal)} {productUnit}</strong></span>
          {selectedProduct && !selectedProduct.currentRecipe && (
            <span style={{ color: '#ef4444' }}>该产品未设置当前配方，请先在工厂产品中配置</span>
          )}
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#2A2418' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>物料投料明细</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th style={th}>序号</th>
                <th style={th}>物料编号</th>
                <th style={th}>比例</th>
                <th style={th}>参考投料 ({productUnit})</th>
                <th style={th}>本次实投 ({productUnit})</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: 'center', padding: '2rem' }}>
                    {isNew ? '请选择有当前配方的产品' : '暂无物料明细'}
                  </td>
                </tr>
              ) : items.map((item, index) => (
                <tr key={item.key}>
                  <td style={td}>{index + 1}</td>
                  <td style={td}>
                    <span className="inline-flex items-center gap-1">
                      {item.productionCode}
                      {item.itemType === 'product_semifinished' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>
                          <FlaskConical size={10} /> Sol.
                        </span>
                      )}
                    </span>
                  </td>
                  <td style={td}>{formatPercent(item.percentage)}</td>
                  <td style={td}>{formatWeight(item.requiredWeight)}</td>
                  <td style={td}>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={item.actualWeight ?? ''}
                      onChange={e => patchActualWeight(item.key, e.target.value === '' ? null : Number(e.target.value))}
                      className="w-28 rounded px-2 py-1 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div style={card} className="p-4 space-y-2">
          <label className="text-xs font-medium" style={{ color: '#C9A96E' }}>生产要求</label>
          <textarea value={productionNotes} onChange={e => setProductionNotes(e.target.value)} rows={4} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y" style={inputStyle()} placeholder="如：1500 转 / 30 分钟" />
        </div>
        <div style={card} className="p-4 space-y-2">
          <label className="text-xs font-medium" style={{ color: '#C9A96E' }}>质检要求</label>
          <textarea value={qualityNotes} onChange={e => setQualityNotes(e.target.value)} rows={4} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y" style={inputStyle()} placeholder="如：先加 A 料；粘度 9.7-9.8..." />
        </div>
        <div style={card} className="p-4 space-y-2">
          <label className="text-xs font-medium" style={{ color: '#C9A96E' }}>包装要求</label>
          <textarea value={packagingNotes} onChange={e => setPackagingNotes(e.target.value)} rows={4} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y" style={inputStyle()} placeholder="如：18KG" />
        </div>
      </div>
    </div>
      </div>{/* end cosmocoat-screen */}
    </>
  )
}
