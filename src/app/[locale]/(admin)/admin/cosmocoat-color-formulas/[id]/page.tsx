'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Printer, Save, Search, Trash2 } from 'lucide-react'
import type { CosColorFormulaCategory } from '@prisma/client'
import { ColorFormulaCategoryFields } from '@/components/cosmocoat/ColorFormulaCategoryFields'
import type { ColorFormulaFactoryProductOption } from '@/lib/cosmocoat/color-formula-factory-products'
import { computeNextColorFormulaCodeForProduct } from '@/lib/cosmocoat/color-formula-code-sequence'
import type { FullColorFormula } from '@/lib/cosmocoat/color-formulas'
import { pantoneToHex } from '@/lib/cosmocoat/pantone-colors'
import {
  computeItemAmount,
  computeItemPercentage,
  computeRecipeTotals,
  formatMoney,
  formatPercent,
  formatWeight,
} from '@/lib/cosmocoat/recipes'
import {
  scaleColorFormulaItemsForProduction,
  type ColorFormulaPrintItem,
} from '@/lib/cosmocoat/color-formula-print'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type PickerMaterial = {
  optionType: 'raw_material' | 'product_semifinished'
  id: string
  productionCode: string
  name: string
  attributeCode: string
  category: string
  primaryPackageKg: number | null
  primaryPricePerKg: number | null
  primaryNotes: string
}

type EditableItem = {
  key: string
  isLocked: boolean
  itemType: 'raw_material' | 'product_semifinished' | 'manual'
  rawMaterialId: string | null
  productSemifinishedId: string | null
  productionCode: string
  name: string
  attributeCode: string
  quantity: number
  actualWeight: number | null
  unitPrice: number | null
  amount: number
  notes: string
}

function normalizeItemType(value: string): EditableItem['itemType'] {
  if (value === 'product_semifinished') return 'product_semifinished'
  if (value === 'manual') return 'manual'
  return 'raw_material'
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

function swatchTextColor(hex: string | null): string {
  if (!hex) return 'var(--muted-foreground)'
  const raw = hex.replace('#', '')
  const value = raw.length === 3
    ? raw.split('').map(char => char + char).join('')
    : raw
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000
  return luminance > 150 ? '#0A0805' : '#FFFFFF'
}

function printDialogInputStyle(): React.CSSProperties {
  return {
    background: '#FFF7E6',
    border: '1px solid #C9A96E',
    color: '#11110E',
    caretColor: '#11110E',
  }
}

function toEditableItem(item: FullColorFormula['items'][number], index: number): EditableItem {
  return {
    key: item.id,
    isLocked: index === 0 && item.attributeCode === '适用产品',
    itemType: normalizeItemType(item.itemType),
    rawMaterialId: item.rawMaterialId,
    productSemifinishedId: item.productSemifinishedId,
    productionCode: item.productionCode,
    name: item.name,
    attributeCode: item.attributeCode,
    quantity: item.quantity,
    actualWeight: item.actualWeight,
    unitPrice: item.unitPrice,
    amount: item.amount ?? 0,
    notes: item.notes,
  }
}

function toEditableFromPicker(m: PickerMaterial): EditableItem {
  const unitPrice = m.primaryPricePerKg
  const quantity = 0
  return {
    key: crypto.randomUUID(),
    isLocked: false,
    itemType: m.optionType,
    rawMaterialId: m.optionType === 'raw_material' ? m.id : null,
    productSemifinishedId: m.optionType === 'product_semifinished' ? m.id : null,
    productionCode: m.productionCode,
    name: m.name,
    attributeCode: m.attributeCode,
    quantity,
    actualWeight: null,
    unitPrice,
    amount: 0,
    notes: '',
  }
}

function toManualItem(): EditableItem {
  return {
    key: crypto.randomUUID(),
    isLocked: false,
    itemType: 'manual',
    rawMaterialId: null,
    productSemifinishedId: null,
    productionCode: '',
    name: '',
    attributeCode: '',
    quantity: 0,
    actualWeight: null,
    unitPrice: null,
    amount: 0,
    notes: '',
  }
}

function makeApplicableProductRow(
  product: { productCode: string; name: string; unitPrice?: number | null },
  recipeCode?: string,
): EditableItem {
  return {
    key: 'applicable-product-locked',
    isLocked: true,
    itemType: 'manual',
    rawMaterialId: null,
    productSemifinishedId: null,
    productionCode: product.productCode,
    name: product.name,
    attributeCode: '适用产品',
    quantity: 0,
    actualWeight: null,
    unitPrice: product.unitPrice ?? null,
    amount: 0,
    notes: recipeCode ? `当前配方：${recipeCode}` : '',
  }
}

const PICKER_TYPE_OPTIONS = [
  { key: 'AD', label: 'AD' },
  { key: 'SO', label: 'SO' },
  { key: 'Sol', label: 'Sol 半成品' },
  { key: 'DY', label: 'DY' },
  { key: 'CO', label: 'CO' },
  { key: 'CA', label: 'CA' },
  { key: 'CC', label: 'CC' },
] as const

const PRINT_DIALOG_CLOSE_DELAY_MS = 180

const COLOR_FORMULA_PRINT_STYLES = `
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
    .cosmocoat-screen,
    [data-slot="dialog-portal"],
    [data-slot="dialog-overlay"],
    [data-slot="dialog-content"] { display: none !important; }

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

    #cosmocoat-print-area * {
      box-sizing: border-box;
      max-width: 100%;
    }

    #cosmocoat-print-area table {
      table-layout: fixed;
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt !important;
    }

    #cosmocoat-print-area td,
    #cosmocoat-print-area th {
      word-break: break-all;
      overflow-wrap: break-word;
      overflow: hidden;
      padding: 4px 6px !important;
      font-size: 10pt !important;
      line-height: 1.4;
    }

    #cosmocoat-print-area .print-section-title {
      font-size: 12pt !important;
      margin-bottom: 6px !important;
    }
  }

  @media screen {
    #cosmocoat-print-area { display: none; }
  }
`

function displayText(value: string | number | null | undefined) {
  const normalized = value == null ? '' : String(value)
  return normalized.trim() || '—'
}

interface ColorFormulaPrintViewProps {
  orderCode: string
  name: string
  categoryLabel: string
  factoryProductLabel: string
  targetKg: number
  notes: string
  items: ColorFormulaPrintItem[]
}

function ColorFormulaPrintView({
  orderCode,
  name,
  categoryLabel,
  factoryProductLabel,
  targetKg,
  notes,
  items,
}: ColorFormulaPrintViewProps) {
  const totalScaled = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalActual = items.some(item => item.actualWeight != null)
    ? items.reduce((sum, item) => sum + (item.actualWeight ?? 0), 0)
    : null

  return (
    <div id="cosmocoat-print-area">
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        调色配方
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 9 }}>
        <tbody>
          <tr>
            <td style={{ width: '15%', padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>调色单号</td>
            <td style={{ width: '35%', padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(orderCode)}</td>
            <td style={{ width: '15%', padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>配方名称</td>
            <td style={{ width: '35%', padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(name)}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>类别</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(categoryLabel)}</td>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>生产重量</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{formatWeight(targetKg, 3)} kg</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>适用产品</td>
            <td colSpan={3} style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(factoryProductLabel)}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>备注</td>
            <td colSpan={3} style={{ padding: '3px 6px', border: '1px solid #ccc', whiteSpace: 'pre-wrap' }}>{displayText(notes)}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-section-title" style={{ fontWeight: 700, fontSize: 10, marginBottom: 4, borderLeft: '3px solid #000', paddingLeft: 6 }}>
        原料明细
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 9 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'center', width: '8%' }}>序号</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'left', width: '18%' }}>生产编号</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'left', width: '34%' }}>原料/产品名称</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'right', width: '14%' }}>用量(kg)</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'right', width: '10%' }}>占比</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'right', width: '12%' }}>实投(kg)</th>
            <th style={{ padding: '3px 6px', border: '1px solid #ccc', fontWeight: 600, textAlign: 'left', width: '10%' }}>备注</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center' }}>暂无原材料明细</td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={`${item.productionCode}-${index}`} style={{ background: index % 2 === 1 ? '#fafafa' : '#fff' }}>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(item.productionCode)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(item.name)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>{formatWeight(item.quantity, 3)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>{formatPercent(item.percentage)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>
                  {item.actualWeight != null ? formatWeight(item.actualWeight, 3) : ''}
                </td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(item.notes)}</td>
              </tr>
            ))
          )}
          {items.length > 0 && (
            <tr style={{ background: '#f0f0f0', fontWeight: 700 }}>
              <td colSpan={3} style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>合计</td>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>{formatWeight(totalScaled, 3)}</td>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>100%</td>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'right' }}>
                {totalActual != null ? formatWeight(totalActual, 3) : ''}
              </td>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc' }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function CosmocoatColorFormulaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const formulaId = params.id as string
  const isNew = formulaId === 'new'

  const initialFactoryProductId = isNew ? (searchParams.get('factoryProductId') || null) : null
  const initialCategory = isNew
    ? ((searchParams.get('category') as CosColorFormulaCategory | null) ?? 'PU')
    : 'PU'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [printKgInput, setPrintKgInput] = useState('')
  const [printTargetKg, setPrintTargetKg] = useState<number | null>(null)
  const [categoryLabel, setCategoryLabel] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<CosColorFormulaCategory>(initialCategory)
  const [factoryProductId, setFactoryProductId] = useState<string | null>(initialFactoryProductId)
  const [factoryProducts, setFactoryProducts] = useState<ColorFormulaFactoryProductOption[]>([])
  const [lastAutoCode, setLastAutoCode] = useState('')
  const [colorCode, setColorCode] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [targetColor, setTargetColor] = useState('')
  const [batchQuantity, setBatchQuantity] = useState(100)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<EditableItem[]>([])

  // Material picker state
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerMaterials, setPickerMaterials] = useState<PickerMaterial[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [selectedPickerKey, setSelectedPickerKey] = useState('')
  const [pickerType, setPickerType] = useState<string | null>(null)

  const loadFormula = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/color-formulas/${formulaId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      const formula = data.formula as FullColorFormula
      setCode(formula.code)
      setName(formula.name)
      setCategory(formula.category)
      setCategoryLabel(formula.categoryLabel)
      setFactoryProductId(formula.factoryProductId)
      setColorCode(formula.colorCode)
      setCustomerName(formula.customerName)
      setTargetColor(formula.targetColor)
      setBatchQuantity(formula.batchQuantity)
      setNotes(formula.notes)
      setItems(formula.items.map((item, index) => toEditableItem(item, index)))
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [formulaId, isNew])

  useEffect(() => {
    loadFormula()
  }, [loadFormula])

  const handleProductsLoaded = useCallback((products: ColorFormulaFactoryProductOption[]) => {
    setFactoryProducts(products)
  }, [])

  const selectedFactoryProduct = useMemo(
    () => factoryProducts.find(product => product.id === factoryProductId),
    [factoryProducts, factoryProductId],
  )

  // Auto-generate formula code when factory product changes (new formulas)
  useEffect(() => {
    if (!isNew) return
    if (!selectedFactoryProduct?.productCode) {
      if (code && code === lastAutoCode) setCode('')
      if (lastAutoCode) setLastAutoCode('')
      return
    }
    if (code && code !== lastAutoCode) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/admin/cosmocoat/color-formulas/by-product/${encodeURIComponent(selectedFactoryProduct.productCode)}`,
        )
        const data = await res.json()
        if (!res.ok || cancelled) return

        const nextCode = computeNextColorFormulaCodeForProduct(
          selectedFactoryProduct.productCode,
          (data.formulas ?? []).map((formula: { code?: string }) => formula.code ?? ''),
        )
        setCode(nextCode)
        setLastAutoCode(nextCode)
        if (!name.trim()) setName(`${selectedFactoryProduct.name} 调色配方`)
      } catch {
        /* keep manual entry available */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [code, isNew, lastAutoCode, name, selectedFactoryProduct])

  // Task 2: Sync the locked applicable-product row when factory product changes
  useEffect(() => {
    if (!selectedFactoryProduct) {
      // Remove the locked row if factory product is cleared
      setItems(prev => prev.filter(item => !item.isLocked))
      return
    }
    const lockedItem = makeApplicableProductRow(selectedFactoryProduct)
    setItems(prev => {
      const lockedIndex = prev.findIndex(item => item.isLocked)
      if (lockedIndex >= 0) {
        const next = [...prev]
        next[lockedIndex] = {
          ...lockedItem,
          key: prev[lockedIndex].key,
          quantity: prev[lockedIndex].quantity,
        }
        return next
      }
      return [lockedItem, ...prev]
    })
  }, [selectedFactoryProduct])

  useEffect(() => {
    const q = pickerQuery.trim()
    if (!pickerType) {
      setPickerMaterials([])
      setPickerLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setPickerLoading(true)
      try {
        const p = new URLSearchParams({ limit: '40' })
        if (q) p.set('q', q)
        p.append('type', pickerType)
        const res = await fetch(`/api/admin/cosmocoat/color-formulas/material-options?${p}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        if (!cancelled && res.ok) setPickerMaterials(data.items ?? [])
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setPickerLoading(false)
      }
    }, q ? 250 : 0)
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(t)
    }
  }, [pickerQuery, pickerType])

  const totals = useMemo(() => {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)
    return computeRecipeTotals(
      items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: computeItemAmount(item.quantity, item.unitPrice, totalQty, batchQuantity),
      })),
      batchQuantity,
    )
  }, [items, batchQuantity])

  const totalQuantity = totals.totalQuantity
  const itemsWithAmounts = useMemo(() => {
    return items.map(item => ({
      ...item,
      amount: computeItemAmount(item.quantity, item.unitPrice, totalQuantity, batchQuantity),
      percentage: computeItemPercentage(item.quantity, totalQuantity),
    }))
  }, [items, totalQuantity, batchQuantity])

  const factoryProductLabel = useMemo(() => {
    if (selectedFactoryProduct) {
      return `${selectedFactoryProduct.productCode} ${selectedFactoryProduct.name}`
    }
    return categoryLabel
  }, [selectedFactoryProduct, categoryLabel])

  const pantonePreviewHex = useMemo(() => pantoneToHex(targetColor), [targetColor])

  const activePrintKg = printTargetKg ?? batchQuantity

  const printItems = useMemo(() => {
    return scaleColorFormulaItemsForProduction(items, totalQuantity, activePrintKg)
  }, [items, activePrintKg, totalQuantity])

  function openPrintDialog() {
    setPrintKgInput(String(batchQuantity))
    setPrintDialogOpen(true)
  }

  function confirmPrint() {
    const targetKg = Number(printKgInput)
    if (!Number.isFinite(targetKg) || targetKg <= 0) {
      toast.error('请输入有效的生产公斤数')
      return
    }
    setPrintTargetKg(targetKg)
    setPrintDialogOpen(false)
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, PRINT_DIALOG_CLOSE_DELAY_MS)
  }

  function updateItem(key: string, patch: Partial<EditableItem>) {
    setItems(prev =>
      prev.map(item => (item.key === key ? { ...item, ...patch } : item)),
    )
  }

  function addMaterial() {
    const material = pickerMaterials.find(m => `${m.optionType}:${m.id}` === selectedPickerKey)
    if (!material) {
      toast.error('请先选择原料')
      return
    }
    if (
      material.optionType === 'raw_material' &&
      items.some(i => i.rawMaterialId === material.id)
    ) {
      toast.error('该原料已在配方中')
      return
    }
    if (
      material.optionType === 'product_semifinished' &&
      items.some(i => i.productSemifinishedId === material.id)
    ) {
      toast.error('该半成品已在配方中')
      return
    }
    setItems(prev => [...prev, toEditableFromPicker(material)])
    setSelectedPickerKey('')
    toast.success(material.optionType === 'product_semifinished' ? '已添加半成品' : '已添加原料')
  }

  function addManualRow() {
    setItems(prev => [...prev, toManualItem()])
    toast.success('已添加空白行')
  }

  function selectPickerType(type: string) {
    if (pickerType === type) return
    setSelectedPickerKey('')
    setPickerMaterials([])
    setPickerType(type)
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  async function saveFormula() {
    if (!name.trim()) {
      toast.error('请填写配方名称')
      return
    }

    setSaving(true)
    const payload = {
      code: code.trim() || undefined,
      name: name.trim(),
      category,
      factoryProductId,
      colorCode,
      customerName,
      targetColor,
      batchQuantity,
      notes,
      items: items.map((item, index) => ({
        rawMaterialId: item.rawMaterialId,
        productSemifinishedId: item.productSemifinishedId,
        productionCode: item.productionCode,
        name: item.name,
        attributeCode: item.attributeCode,
        sortOrder: index + 1,
        quantity: item.quantity,
        actualWeight: item.actualWeight,
        unitPrice: item.unitPrice,
        notes: item.notes,
      })),
    }

    try {
      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/color-formulas' : `/api/admin/cosmocoat/color-formulas/${formulaId}`,
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
      toast.success(isNew ? '调色配方已创建' : '已保存')
      if (isNew && data.formula?.id) {
        router.replace(`/admin/cosmocoat-color-formulas/${data.formula.id}`)
      } else {
        loadFormula()
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
      <style>{COLOR_FORMULA_PRINT_STYLES}</style>

      {!isNew && (
        <ColorFormulaPrintView
          orderCode={code}
          name={name}
          categoryLabel={categoryLabel}
          factoryProductLabel={factoryProductLabel}
          targetKg={activePrintKg}
          notes={notes}
          items={printItems}
        />
      )}

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>打印调色配方</DialogTitle>
            <DialogDescription>
              请输入本次目标生产公斤数，系统将按配方比例自动换算各原料用量后生成 PDF 打印。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              目标生产公斤数 (kg)
            </label>
            <input
              type="number"
              min={0.001}
              step={0.001}
              value={printKgInput}
              onChange={e => setPrintKgInput(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={printDialogInputStyle()}
              autoFocus
            />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              基准批量 {formatWeight(batchQuantity, 3)} kg，当前明细合计 {formatWeight(totalQuantity, 3)} kg
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPrintDialogOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={confirmPrint}
              disabled={printing}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              {printing ? '打印中...' : '确认打印'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="cosmocoat-screen">
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-color-formulas" className="p-2 rounded-lg" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? '新建调色配方' : '调色配方详情'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {isNew ? '填写基本信息并添加原料' : `${code} · ${name}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={openPrintDialog}
              disabled={printing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
            >
              <Printer size={14} /> 打印文件
            </button>
          )}
          <button
            type="button"
            onClick={saveFormula}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <Save size={14} /> {saving ? '保存中...' : (isNew ? '创建' : '保存')}
          </button>
        </div>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>基本信息</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ColorFormulaCategoryFields
            className="sm:col-span-2 lg:col-span-2"
            category={category}
            factoryProductId={factoryProductId}
            onCategoryChange={setCategory}
            onFactoryProductChange={setFactoryProductId}
            onProductsLoaded={handleProductsLoaded}
            inputStyle={inputStyle()}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方编号</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="留空自动生成" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方名称</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>基准批量 (kg)</label>
            <input type="number" min={0.001} step={0.001} value={batchQuantity} onChange={e => setBatchQuantity(Number(e.target.value) || 100)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>客户</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Pantone 颜色</label>
            <div className="grid sm:grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <input
                value={targetColor}
                onChange={e => setTargetColor(e.target.value)}
                placeholder="例如 Pantone 185 C、Cool Gray 7 C 或 #E4002B"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle()}
              />
              <div
                className="rounded-lg border flex items-center justify-center text-[11px] font-medium"
                title={pantonePreviewHex ? `Pantone 预览 ${pantonePreviewHex}` : '未匹配到 Pantone 预览色'}
                style={{
                  minHeight: '2.625rem',
                  borderColor: '#2A2418',
                  background: pantonePreviewHex ?? '#0E0E0A',
                  color: swatchTextColor(pantonePreviewHex),
                }}
              >
                {pantonePreviewHex ? pantonePreviewHex.toUpperCase() : '无预览'}
              </div>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>备注</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y" style={inputStyle()} />
          </div>
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: '#2A2418' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>原料明细</h3>
            <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              合计 {formatMoney(totals.totalAmount)} · 成本单价 {formatMoney(totals.unitCost)} / {batchQuantity} kg
            </div>
          </div>
          <button type="button" onClick={addManualRow} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}>
            <Plus size={13} /> 空白行
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th style={th}>序号</th>
                <th style={th}>生产编号</th>
                <th style={th}>名称</th>
                <th style={th}>属性</th>
                <th style={th}>数量</th>
                <th style={th}>占比</th>
                <th style={th}>实投(kg)</th>
                <th style={th}>单价(元)</th>
                <th style={th}>金额(元)</th>
                <th style={th}>备注</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {itemsWithAmounts.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ ...td, textAlign: 'center', padding: '2rem' }}>请从下方选择原料、Sol. 半成品或添加空白行</td>
                </tr>
              ) : (
                itemsWithAmounts.map((item, index) => (
                  <tr key={item.key} style={item.isLocked ? { background: 'rgba(201,169,110,0.06)' } : undefined}>
                    <td style={td}>{index + 1}</td>
                    <td style={{ ...td, color: 'var(--foreground)' }}>
                      {item.itemType === 'manual' && !item.isLocked ? (
                        <input
                          value={item.productionCode}
                          onChange={e => updateItem(item.key, { productionCode: e.target.value })}
                          className="w-28 rounded px-2 py-1 text-sm outline-none"
                          style={inputStyle()}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1" style={item.isLocked ? { color: '#C9A96E', fontWeight: 500 } : undefined}>
                          {item.productionCode || '—'}
                          {item.itemType === 'product_semifinished' && (
                            <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>Sol.</span>
                          )}
                          {item.itemType === 'manual' && !item.isLocked && (
                            <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(122,112,96,0.15)', color: '#7A7060' }}>手工</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      {item.itemType === 'manual' && !item.isLocked ? (
                        <input
                          value={item.name}
                          onChange={e => updateItem(item.key, { name: e.target.value })}
                          className="w-full min-w-[10rem] rounded px-2 py-1 text-sm outline-none"
                          style={inputStyle()}
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td style={td}>
                      {item.itemType === 'manual' && !item.isLocked ? (
                        <input
                          value={item.attributeCode}
                          onChange={e => updateItem(item.key, { attributeCode: e.target.value })}
                          className="w-24 rounded px-2 py-1 text-sm outline-none"
                          style={inputStyle()}
                        />
                      ) : (
                        <span style={item.isLocked ? { color: '#C9A96E', fontSize: '0.75rem' } : undefined}>
                          {item.attributeCode || '—'}
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        min={0}
                        step={0.001}
                        value={item.quantity}
                        onChange={e => updateItem(item.key, { quantity: Number(e.target.value) || 0 })}
                        className="w-24 rounded px-2 py-1 text-sm outline-none"
                        style={inputStyle()}
                      />
                    </td>
                    <td style={td}>{formatPercent(item.percentage)}</td>
                    <td style={td}>
                      {item.isLocked ? (
                        '—'
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={0.001}
                          value={item.actualWeight ?? ''}
                          onChange={e => updateItem(item.key, {
                            actualWeight: e.target.value === '' ? null : Number(e.target.value),
                          })}
                          className="w-24 rounded px-2 py-1 text-sm outline-none"
                          style={inputStyle()}
                        />
                      )}
                    </td>
                    <td style={td}>
                      {item.isLocked ? (
                        <span title="取自工厂产品单价">{formatMoney(item.unitPrice)}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={0.0001}
                          value={item.unitPrice ?? ''}
                          onChange={e => updateItem(item.key, { unitPrice: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-24 rounded px-2 py-1 text-sm outline-none"
                          style={inputStyle()}
                        />
                      )}
                    </td>
                    <td style={td}>{formatMoney(item.amount, 3)}</td>
                    <td style={td}>
                      {item.isLocked ? (
                        <span className="text-xs" style={{ color: '#5A5040' }}>{item.notes}</span>
                      ) : (
                        <input
                          value={item.notes}
                          onChange={e => updateItem(item.key, { notes: e.target.value })}
                          className="w-full min-w-[8rem] rounded px-2 py-1 text-sm outline-none"
                          style={inputStyle()}
                        />
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {!item.isLocked && (
                        <button type="button" onClick={() => removeItem(item.key)} className="p-1.5 rounded" style={{ color: '#ef4444' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: '#2A2418' }}>
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>待选物料</h3>
          </div>
          {pickerQuery.trim() && (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              正在所选类型中搜索物料
            </span>
          )}
        </div>
        <div className="grid lg:grid-cols-[12rem_1fr] min-h-[14rem]">
          <div
            className="border-r overflow-y-auto max-h-72 lg:max-h-80"
            style={{ borderColor: '#2A2418' }}
          >
            {PICKER_TYPE_OPTIONS.map(option => {
              const checked = pickerType === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => selectPickerType(option.key)}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  aria-pressed={checked}
                  style={{
                    background: checked ? 'rgba(201,169,110,0.12)' : 'transparent',
                    color: checked ? '#C9A96E' : 'var(--muted-foreground)',
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: checked ? '#C9A96E' : '#3A3020' }}
                    />
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="p-3 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[12rem]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  value={pickerQuery}
                  onChange={e => {
                    setPickerQuery(e.target.value)
                    setSelectedPickerKey('')
                  }}
                  placeholder="搜索全部候选物料（编号、名称、类别）..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <button
                type="button"
                onClick={addMaterial}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}
              >
                添加选中
              </button>
            </div>
            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              {pickerLoading ? (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>加载物料...</p>
              ) : pickerMaterials.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: '#5A5040' }}>
                  {pickerQuery.trim()
                    ? '未找到匹配物料'
                    : !pickerType
                      ? '请从左侧选择一个分类以筛选物料'
                      : '当前分类下暂无候选物料'}
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th style={th}>编号</th>
                      <th style={th}>名称</th>
                      <th style={th}>属性</th>
                      <th style={th}>规格</th>
                      <th style={th}>单价</th>
                      <th style={th}>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickerMaterials.map(material => {
                      const pickerKey = `${material.optionType}:${material.id}`
                      const alreadyAdded = material.optionType === 'raw_material'
                        ? items.some(item => item.rawMaterialId === material.id)
                        : items.some(item => item.productSemifinishedId === material.id)
                      return (
                        <tr
                          key={pickerKey}
                          onClick={() => !alreadyAdded && setSelectedPickerKey(pickerKey)}
                          className={alreadyAdded ? 'opacity-40' : 'cursor-pointer'}
                          style={{
                            background: selectedPickerKey === pickerKey && !alreadyAdded
                              ? 'rgba(201,169,110,0.08)'
                              : 'transparent',
                          }}
                        >
                          <td style={td}>{material.productionCode}</td>
                          <td style={td}>{material.name}</td>
                          <td style={td}>{material.attributeCode}</td>
                          <td style={td}>{material.primaryPackageKg ?? '—'}</td>
                          <td style={td}>{formatMoney(material.primaryPricePerKg)}</td>
                          <td style={td}>{material.primaryNotes || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
      </div>
    </>
  )
}
