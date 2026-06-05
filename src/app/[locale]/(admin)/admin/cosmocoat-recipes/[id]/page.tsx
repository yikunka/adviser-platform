'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Boxes, FlaskConical, GripVertical, Printer, RefreshCw, Save, Search, Trash2 } from 'lucide-react'
import type { FullRecipe } from '@/lib/cosmocoat/recipe-serializer'
import {
  MATERIAL_ATTRIBUTE_GROUPS,
  computeItemAmount,
  computeItemPercentage,
  computeRecipeTotals,
  formatMoney,
  formatPercent,
  PACKAGING_REQUIREMENT_PRESETS,
} from '@/lib/cosmocoat/recipes'
import { VISCOSITY_UNITS, type ViscosityUnit } from '@/lib/cosmocoat/product-viscosity'

type PickerMaterial = {
  id: string
  productionCode: string
  name: string
  attributeCode: string
  category: string
  primaryPackageKg: number | null
  primaryPricePerKg: number | null
  primaryNotes: string
}

// Semi-finished items are recipes whose category name contains "半成品"
type PickerSemifinished = {
  id: string
  code: string
  name: string
  batchQuantity: number
  unitCost: number | null
  notes: string
  category: { id: string; code: string; name: string }
}

type PickerFinishedProduct = {
  id: string
  productCode: string
  name: string
  unit: string
  unitPrice: number | null
  notes: string
  category: { id: string; name: string } | null
}

type PickerMode = 'raw_material' | 'semi_finished' | 'factory_product'

type RecipeCategoryOption = {
  id: string
  code: string
  name: string
}

function mapRecipeCategoryOption(c: { id: string; code: string; name: string }): RecipeCategoryOption {
  return { id: c.id, code: c.code, name: c.name }
}

type EditableItem = {
  key: string
  itemType: 'raw_material' | 'recipe' | 'product_semifinished' | 'factory_product'
  rawMaterialId?: string
  recipeId?: string
  productSemifinishedId?: string
  factoryProductId?: string
  productionCode: string
  name: string
  packageKg: number | null
  stock?: number | null
  unit?: string
  sourceOrderCode?: string | null
  quantity: number
  unitPrice: number | null
  amount: number
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

function toEditableItemFromMaterial(material: PickerMaterial, quantity = 0, notes = ''): EditableItem {
  const unitPrice = material.primaryPricePerKg
  const qty = quantity
  return {
    key: material.id,
    itemType: 'raw_material',
    rawMaterialId: material.id,
    productionCode: material.productionCode,
    name: material.name,
    packageKg: material.primaryPackageKg,
    quantity: qty,
    unitPrice,
    amount: 0,
    notes,
  }
}

function toEditableItemFromSemifinished(
  semifinished: PickerSemifinished,
  quantity = 0,
  notes = '',
): EditableItem {
  const unitPrice = semifinished.unitCost
  const qty = quantity
  return {
    key: semifinished.id,
    itemType: 'recipe',
    recipeId: semifinished.id,
    productionCode: semifinished.code,
    name: semifinished.name,
    packageKg: semifinished.batchQuantity,
    quantity: qty,
    unitPrice,
    amount: 0,
    notes,
  }
}

function toEditableItemFromFinishedProduct(
  product: PickerFinishedProduct,
  quantity = 0,
  notes = '',
): EditableItem {
  return {
    key: product.id,
    itemType: 'factory_product',
    factoryProductId: product.id,
    productionCode: product.productCode,
    name: product.name,
    packageKg: null,
    unit: product.unit,
    quantity,
    unitPrice: product.unitPrice,
    amount: 0,
    notes,
  }
}

export default function AdminCosmoCoatRecipeEditorPage() {
  const params = useParams()
  const router = useRouter()
  const recipeId = params.id as string
  const isNew = recipeId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [categories, setCategories] = useState<RecipeCategoryOption[]>([])
  const [pickerMode, setPickerMode] = useState<PickerMode>('raw_material')
  const [pickerMaterials, setPickerMaterials] = useState<PickerMaterial[]>([])
  const [pickerSemifinished, setPickerSemifinished] = useState<PickerSemifinished[]>([])
  const [pickerFinishedProducts, setPickerFinishedProducts] = useState<PickerFinishedProduct[]>([])
  const [semifinishedCategories, setSemifinishedCategories] = useState<{ id: string; name: string }[]>([])
  const [finishedProductCategories, setFinishedProductCategories] = useState<{ id: string; name: string }[]>([])
  const [semifinishedCategoryFilter, setSemifinishedCategoryFilter] = useState('')
  const [finishedProductCategoryFilter, setFinishedProductCategoryFilter] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)
  const [attributeFilter, setAttributeFilter] = useState('RS')
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedPickerId, setSelectedPickerId] = useState<string | null>(null)

  const displayedSemifinished = useMemo(() => {
    if (!semifinishedCategoryFilter || pickerSearch.trim()) return pickerSemifinished
    return pickerSemifinished.filter(s => s.category.id === semifinishedCategoryFilter)
  }, [pickerSemifinished, semifinishedCategoryFilter, pickerSearch])

  const displayedFinishedProducts = useMemo(() => {
    if (!finishedProductCategoryFilter || pickerSearch.trim()) return pickerFinishedProducts
    return pickerFinishedProducts.filter(p => p.category?.id === finishedProductCategoryFilter)
  }, [pickerFinishedProducts, finishedProductCategoryFilter, pickerSearch])

  const [categoryId, setCategoryId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [batchQuantity, setBatchQuantity] = useState(100)
  const [viscosity, setViscosity] = useState('')
  const [viscosityUnit, setViscosityUnit] = useState<ViscosityUnit>('S')
  const [notes, setNotes] = useState('')
  const [productionSpeedRequirements, setProductionSpeedRequirements] = useState('')
  const [productionTimeRequirements, setProductionTimeRequirements] = useState('')
  const [packagingRequirements, setPackagingRequirements] = useState('')
  const [productionNotes, setProductionNotes] = useState('')
  const [qcTestStandard, setQcTestStandard] = useState('')
  const [qcResult, setQcResult] = useState('')
  const [formulaIsUsed, setFormulaIsUsed] = useState(false)
  const [items, setItems] = useState<EditableItem[]>([])

  const totals = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    return computeRecipeTotals(
      items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: computeItemAmount(item.quantity, item.unitPrice, totalQuantity, batchQuantity),
      })),
      batchQuantity,
    )
  }, [items, batchQuantity])

  const itemsWithPercentage = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    return items.map(item => ({
      ...item,
      percentage: computeItemPercentage(item.quantity, totalQuantity),
      amount: computeItemAmount(item.quantity, item.unitPrice, totalQuantity, batchQuantity),
    }))
  }, [items, batchQuantity])

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cosmocoat/recipe-categories')
      const data = await res.json()
      if (!res.ok) return
      const list: RecipeCategoryOption[] = (data.categories ?? []).map(mapRecipeCategoryOption)
      setCategories(list)
      if (isNew && list.length > 0) {
        setCategoryId(prev => prev || list[0].id)
      }
    } catch {
      // non-blocking
    }
  }, [isNew])

  const loadRecipe = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const [recipeRes, categoryRes] = await Promise.all([
        fetch(`/api/admin/cosmocoat/recipes/${recipeId}`),
        fetch('/api/admin/cosmocoat/recipe-categories'),
      ])
      const recipeData = await recipeRes.json()
      const categoryData = await categoryRes.json()
      if (!recipeRes.ok) {
        toast.error(recipeData.error ?? '加载配方失败')
        return
      }
      const recipe = recipeData.recipe as FullRecipe
      const cats: RecipeCategoryOption[] = (categoryData.categories ?? []).map(mapRecipeCategoryOption)
      setCategories(cats)
      setCategoryId(recipe.categoryId)
      setCode(recipe.code)
      setName(recipe.name)
      setBatchQuantity(recipe.batchQuantity)
      setViscosity(recipe.viscosity ?? '')
      setViscosityUnit((recipe.viscosityUnit as ViscosityUnit | null) ?? 'S')
      setNotes(recipe.notes)
      setProductionSpeedRequirements(recipe.productionSpeedRequirements)
      setProductionTimeRequirements(recipe.productionTimeRequirements)
      setPackagingRequirements(recipe.packagingRequirements)
      setProductionNotes(recipe.productionNotes)
      setQcTestStandard(recipe.qcTestStandard)
      setQcResult(recipe.qcResult)
      setFormulaIsUsed(recipe.formulaIsUsed)
      setItems(recipe.items.map(item => {
        if (item.itemType === 'factory_product' && item.factoryProduct) {
          const product = item.factoryProduct
          return {
            key: item.id,
            itemType: 'factory_product' as const,
            factoryProductId: product.id,
            productionCode: product.productCode,
            name: product.name,
            packageKg: null,
            unit: product.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount ?? 0,
            notes: item.notes,
          }
        }
        if (item.itemType === 'product_semifinished' && item.productSemifinished) {
          const sf = item.productSemifinished
          return {
            key: item.id,
            itemType: 'product_semifinished' as const,
            productSemifinishedId: sf.id,
            productionCode: sf.code,
            name: sf.name,
            packageKg: null,
            stock: sf.stock,
            unit: sf.unit,
            sourceOrderCode: sf.sourceProductionOrder?.code ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount ?? 0,
            notes: item.notes,
          }
        }
        if (item.itemType === 'recipe' && item.recipe) {
          return {
            key: item.id,
            itemType: 'recipe' as const,
            recipeId: item.recipe.id,
            productionCode: item.recipe.code,
            name: item.recipe.name,
            packageKg: item.recipe.batchQuantity,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount ?? 0,
            notes: item.notes,
          }
        }
        const material = item.rawMaterial!
        return {
          key: item.id,
          itemType: 'raw_material' as const,
          rawMaterialId: material.id,
          productionCode: material.productionCode,
          name: material.name,
          packageKg: material.packageKg,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount ?? 0,
          notes: item.notes,
        }
      }))
    } catch {
      toast.error('加载配方失败')
    } finally {
      setLoading(false)
    }
  }, [recipeId, isNew])

  const loadPickerMaterials = useCallback(async () => {
    setPickerLoading(true)
    try {
      const q = pickerSearch.trim()
      const params = new URLSearchParams({ limit: '200' })
      if (q) {
        params.set('q', q)
      } else {
        params.set('attribute', attributeFilter)
      }
      const res = await fetch(`/api/admin/cosmocoat/raw-materials?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载原料失败')
        return
      }
      setPickerMaterials((data.items ?? []).map((item: PickerMaterial & {
        primaryPackageKg?: number | null
        primaryPricePerKg?: number | null
        primaryNotes?: string
      }) => ({
        id: item.id,
        productionCode: item.productionCode,
        name: item.name,
        attributeCode: item.attributeCode,
        category: item.category,
        primaryPackageKg: item.primaryPackageKg ?? null,
        primaryPricePerKg: item.primaryPricePerKg ?? null,
        primaryNotes: item.primaryNotes ?? '',
      })))
    } catch {
      toast.error('加载原料失败')
    } finally {
      setPickerLoading(false)
    }
  }, [attributeFilter, pickerSearch])

  const loadPickerSemifinished = useCallback(async () => {
    setPickerLoading(true)
    try {
      const params = new URLSearchParams({ semiFinished: 'true', limit: '200' })
      const q = pickerSearch.trim()
      if (q) params.set('q', q)
      if (!isNew) params.set('excludeId', recipeId)
      const res = await fetch(`/api/admin/cosmocoat/recipes?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载半成品配方失败')
        return
      }
      const items: PickerSemifinished[] = data.items ?? []
      setPickerSemifinished(items)
      // Extract unique categories from returned items, preserving order
      const catMap = new Map<string, { id: string; name: string }>()
      for (const item of items) {
        if (item.category?.id && !catMap.has(item.category.id)) {
          catMap.set(item.category.id, { id: item.category.id, name: item.category.name })
        }
      }
      const cats = Array.from(catMap.values())
      setSemifinishedCategories(cats)
      // Auto-select first category if none selected yet
      setSemifinishedCategoryFilter(prev => prev || (cats[0]?.id ?? ''))
    } catch {
      toast.error('加载半成品配方失败')
    } finally {
      setPickerLoading(false)
    }
  }, [pickerSearch, isNew, recipeId, setSemifinishedCategoryFilter])

  const loadPickerFinishedProducts = useCallback(async () => {
    setPickerLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      const q = pickerSearch.trim()
      if (q) params.set('q', q)
      const res = await fetch(`/api/admin/cosmocoat/factory-products?${params}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载成品失败')
        return
      }
      setPickerFinishedProducts((data.items ?? []).map((item: PickerFinishedProduct) => ({
        id: item.id,
        productCode: item.productCode,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        notes: item.notes ?? '',
        category: item.category,
      })))
      if (!pickerSearch.trim()) {
        const catMap = new Map<string, { id: string; name: string }>()
        for (const item of data.items ?? []) {
          if (item.category?.id && !catMap.has(item.category.id)) {
            catMap.set(item.category.id, { id: item.category.id, name: item.category.name })
          }
        }
        const cats = Array.from(catMap.values())
        setFinishedProductCategories(cats)
        setFinishedProductCategoryFilter(prev => prev || (cats[0]?.id ?? ''))
      }
    } catch {
      toast.error('加载成品失败')
    } finally {
      setPickerLoading(false)
    }
  }, [pickerSearch])

  useEffect(() => {
    if (isNew) {
      loadCategories().finally(() => setLoading(false))
    } else {
      loadRecipe()
    }
  }, [isNew, loadCategories, loadRecipe])

  useEffect(() => {
    if (pickerMode !== 'raw_material') return
    const t = setTimeout(loadPickerMaterials, pickerSearch.trim() ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadPickerMaterials, pickerSearch, attributeFilter, pickerMode])

  useEffect(() => {
    if (pickerMode !== 'semi_finished') return
    const t = setTimeout(loadPickerSemifinished, pickerSearch.trim() ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadPickerSemifinished, pickerSearch, pickerMode, semifinishedCategoryFilter])

  useEffect(() => {
    if (pickerMode !== 'factory_product') return
    const t = setTimeout(loadPickerFinishedProducts, pickerSearch.trim() ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadPickerFinishedProducts, pickerSearch, pickerMode, finishedProductCategoryFilter])

  function switchPickerMode(mode: PickerMode) {
    setPickerMode(mode)
    setSelectedPickerId(null)
    setPickerSearch('')
  }

  function patchItem(key: string, patch: Partial<EditableItem>) {
    setItems(prev => prev.map(item => (item.key === key ? { ...item, ...patch } : item)))
  }

  function addSelectedPickerItem() {
    if (pickerMode === 'factory_product') {
      const product = pickerFinishedProducts.find(p => p.id === selectedPickerId)
      if (!product) {
        toast.error('请先选择成品')
        return
      }
      if (items.some(item => item.itemType === 'factory_product' && item.factoryProductId === product.id)) {
        toast.error('该成品已在配方中')
        return
      }
      setItems(prev => [...prev, { ...toEditableItemFromFinishedProduct(product), key: crypto.randomUUID() }])
      toast.success('已添加成品')
      return
    }

    if (pickerMode === 'semi_finished') {
      const semifinished = pickerSemifinished.find(s => s.id === selectedPickerId)
      if (!semifinished) {
        toast.error('请先选择 Sol. 半成品')
        return
      }
      if (items.some(item => item.itemType === 'recipe' && item.recipeId === semifinished.id)) {
        toast.error('该半成品配方已在配方中')
        return
      }
      setItems(prev => [...prev, { ...toEditableItemFromSemifinished(semifinished), key: crypto.randomUUID() }])
      toast.success('已添加半成品配方')
      return
    }

    const material = pickerMaterials.find(m => m.id === selectedPickerId)
    if (!material) {
      toast.error('请先选择原料')
      return
    }
    if (items.some(item => item.itemType === 'raw_material' && item.rawMaterialId === material.id)) {
      toast.error('该原料已在配方中')
      return
    }
    setItems(prev => [...prev, { ...toEditableItemFromMaterial(material), key: crypto.randomUUID() }])
    toast.success('已添加原料')
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(item => item.key !== key))
  }

  async function saveRecipe() {
    if (!categoryId) {
      toast.error('请选择目录')
      return
    }
    if ((!isNew && !code.trim()) || !name.trim()) {
      toast.error('请填写配方编号和名称')
      return
    }

    setSaving(true)
    const payload = {
      categoryId,
      code: code.trim(),
      name: name.trim(),
      batchQuantity,
      viscosity,
      viscosityUnit,
      notes,
      productionSpeedRequirements,
      productionTimeRequirements,
      packagingRequirements,
      productionNotes,
      qcTestStandard,
      qcResult,
      items: items.map((item, index) => ({
        ...(item.itemType === 'recipe'
          ? { recipeId: item.recipeId }
          : item.itemType === 'product_semifinished'
            ? { productSemifinishedId: item.productSemifinishedId }
            : item.itemType === 'factory_product'
              ? { factoryProductId: item.factoryProductId }
              : { rawMaterialId: item.rawMaterialId }),
        sortOrder: index + 1,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.notes,
      })),
    }

    try {
      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/recipes' : `/api/admin/cosmocoat/recipes/${recipeId}`,
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
      toast.success(isNew ? '配方已创建' : '配方已保存')
      if (isNew && data.recipe?.id) {
        router.replace(`/admin/cosmocoat-recipes/${data.recipe.id}`)
      } else {
        loadRecipe()
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function refreshPrices() {
    if (isNew) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/recipes/${recipeId}/refresh-prices`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '更新价格失败')
        return
      }
      toast.success('已从原料表、成品和 Sol. 半成品更新价格')
      loadRecipe()
    } catch {
      toast.error('更新价格失败')
    } finally {
      setRefreshing(false)
    }
  }

  async function autoSaveOrder(newItems: EditableItem[]) {
    if (isNew) return
    try {
      await fetch(`/api/admin/cosmocoat/recipes/${recipeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: newItems.map((item, index) => ({
            ...(item.itemType === 'recipe'
              ? { recipeId: item.recipeId }
              : item.itemType === 'product_semifinished'
                ? { productSemifinishedId: item.productSemifinishedId }
                : item.itemType === 'factory_product'
                  ? { factoryProductId: item.factoryProductId }
                  : { rawMaterialId: item.rawMaterialId }),
            sortOrder: index + 1,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
          })),
        }),
      })
    } catch {
      toast.error('排序保存失败')
    }
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault()
    const fromIndex = dragIndexRef.current
    if (fromIndex === null || fromIndex === index) {
      setDragOverIndex(null)
      dragIndexRef.current = null
      return
    }
    const newItems = [...items]
    const [moved] = newItems.splice(fromIndex, 1)
    newItems.splice(index, 0, moved)
    setItems(newItems)
    setDragOverIndex(null)
    dragIndexRef.current = null
    autoSaveOrder(newItems)
  }

  function handleDragEnd() {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-recipes" className="p-2 rounded-lg" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? '新建配方' : '配方详情'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {isNew ? '填写基本信息并添加原料，保存后生效' : `${code} · ${name}`}
            </p>
            {!isNew && (
              <p className="text-xs mt-2">
                <span
                  className="inline-flex px-2 py-0.5 rounded-md font-medium"
                  style={{
                    background: formulaIsUsed ? 'rgba(74,159,82,0.15)' : 'rgba(122,112,96,0.15)',
                    color: formulaIsUsed ? '#4A9F52' : '#7A7060',
                  }}
                  title={formulaIsUsed ? '已被工厂产品直接或间接使用' : '未被任何工厂产品使用'}
                >
                  {formulaIsUsed ? '已被工厂产品使用' : '未被工厂产品使用'}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && (
            <>
              <button type="button" onClick={refreshPrices} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-50" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
                <RefreshCw size={14} /> {refreshing ? '更新中...' : '更新价格'}
              </button>
              <a
                href={`/api/admin/cosmocoat/recipes/${recipeId}/print`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
              >
                <Printer size={14} /> 打印文件
              </a>
            </>
          )}
          <button type="button" onClick={saveRecipe} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: '#C9A96E', color: '#0A0805' }}>
            <Save size={14} /> {saving ? '保存中...' : (isNew ? '创建' : '保存')}
          </button>
        </div>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>基本信息</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>目录</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()}>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.code} {category.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方编号</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="系统自动生成，无需手动填写" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>配方名称</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>每生产产品数量</label>
            <input type="number" min={0.001} step="0.001" value={batchQuantity} onChange={e => setBatchQuantity(Number(e.target.value) || 100)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle()} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span style={{ color: 'var(--muted-foreground)' }}>产品成本单价：<strong style={{ color: '#C9A96E' }}>{formatMoney(totals.unitCost)}</strong></span>
          <span style={{ color: 'var(--muted-foreground)' }}>材料数量合计：{formatMoney(totals.totalQuantity, 3)}</span>
          <span style={{ color: 'var(--muted-foreground)' }}>材料金额合计：{formatMoney(totals.totalAmount, 3)} 元</span>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>产品黏度（可选）</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={viscosity}
              onChange={e => setViscosity(e.target.value)}
              className="flex-1 min-w-0 rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
              placeholder="例如 9.7-9.8"
            />
            <select
              value={viscosityUnit}
              onChange={e => setViscosityUnit(e.target.value as ViscosityUnit)}
              className="w-24 shrink-0 rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            >
              {VISCOSITY_UNITS.map(unit => (
                <option key={unit} value={unit}>{unit === 'S' ? 'S（秒）' : 'KU'}</option>
              ))}
            </select>
          </div>
          <p className="text-xs" style={{ color: '#5A5040' }}>支持输入范围值，单位可选 S 或 KU</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>备注</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y" style={inputStyle()} />
        </div>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>生产工艺</h3>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          创建生产单时将按当前配方自动带出以下要求
        </p>
        <div className="grid sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产转速要求</label>
            <textarea
              value={productionSpeedRequirements}
              onChange={e => setProductionSpeedRequirements(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder="如：1500 转"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产时间要求</label>
            <textarea
              value={productionTimeRequirements}
              onChange={e => setProductionTimeRequirements(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder="如：30 分钟"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>包装要求</label>
            <div className="flex flex-wrap gap-1.5">
              {PACKAGING_REQUIREMENT_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPackagingRequirements(preset)}
                  className="px-2.5 py-1 rounded-md text-xs transition-colors"
                  style={{
                    border: '1px solid #2A2418',
                    background: packagingRequirements === preset ? 'rgba(201,169,110,0.15)' : '#0E0E0A',
                    color: packagingRequirements === preset ? '#C9A96E' : 'var(--muted-foreground)',
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              value={packagingRequirements}
              onChange={e => setPackagingRequirements(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder="手动填写或点选上方预设"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>生产注意事项</label>
            <textarea
              value={productionNotes}
              onChange={e => setProductionNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder="如：先加 A 料再慢慢加入 B 料"
            />
          </div>
        </div>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>QC（质量控制）</h3>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          与生产工艺分开维护；创建生产单时将写入质检要求
        </p>
        <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>测试标准</label>
            <textarea
              value={qcTestStandard}
              onChange={e => setQcTestStandard(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder="如：粘度 9.7–9.8 S"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>结果</label>
            <textarea
              value={qcResult}
              onChange={e => setQcResult(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder="如：合格 / 实测值"
            />
          </div>
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#2A2418' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>配方物料</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th style={{ ...th, width: '2rem' }}></th>
                <th style={th}>序号</th>
                <th style={th}>编号</th>
                <th style={th}>名称</th>
                <th style={th}>规格</th>
                <th style={th}>数量</th>
                <th style={th}>占比</th>
                <th style={th}>单价(元)</th>
                <th style={th}>金额(元)</th>
                <th style={th}>备注</th>
                <th style={{ ...th, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {itemsWithPercentage.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ ...td, textAlign: 'center', padding: '2rem' }}>请从下方选择原材料、半成品或成品</td>
                </tr>
              ) : itemsWithPercentage.map((item, index) => (
                <tr
                  key={item.key}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={e => handleDragOver(e, index)}
                  onDrop={e => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{ background: dragOverIndex === index ? 'rgba(201,169,110,0.08)' : 'transparent', outline: dragOverIndex === index ? '1px dashed rgba(201,169,110,0.4)' : 'none' }}
                >
                  <td style={{ ...td, cursor: 'grab', color: '#3A3020' }}>
                    <GripVertical size={14} />
                  </td>
                  <td style={td}>{index + 1}</td>
                  <td style={td}>
                    <span className="inline-flex items-center gap-1">
                      {item.productionCode}
                      {item.itemType === 'product_semifinished' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>
                          <FlaskConical size={10} /> Sol.
                        </span>
                      )}
                      {item.itemType === 'recipe' && (
                        <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>配方</span>
                      )}
                      {item.itemType === 'factory_product' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>
                          <Boxes size={10} /> 成品
                        </span>
                      )}
                    </span>
                  </td>
                  <td style={td}>
                    {item.name}
                    {item.sourceOrderCode && (
                      <span className="block text-[10px] mt-0.5" style={{ color: '#5A5040' }}>来源: {item.sourceOrderCode}</span>
                    )}
                  </td>
                  <td style={td}>
                    {item.itemType === 'product_semifinished'
                      ? `库存 ${item.stock ?? '—'} ${item.unit ?? 'kg'}`
                      : item.itemType === 'factory_product'
                        ? item.unit ?? 'kg'
                        : `${item.packageKg ?? '—'}${item.itemType === 'recipe' ? ' kg/批' : ''}`}
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={item.quantity}
                      onChange={e => patchItem(item.key, { quantity: Number(e.target.value) || 0 })}
                      className="w-24 rounded px-2 py-1 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </td>
                  <td style={td}>{formatPercent(item.percentage)}</td>
                  <td style={td}>
                    <input
                      type="number"
                      min={0}
                      step="0.0001"
                      value={item.unitPrice ?? ''}
                      onChange={e => patchItem(item.key, { unitPrice: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-24 rounded px-2 py-1 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </td>
                  <td style={td}>{formatMoney(item.amount, 3)}</td>
                  <td style={td}>
                    <input
                      value={item.notes}
                      onChange={e => patchItem(item.key, { notes: e.target.value })}
                      className="w-full min-w-[8rem] rounded px-2 py-1 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button type="button" onClick={() => removeItem(item.key)} className="p-1.5 rounded-md" style={{ color: '#ef4444' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: '#2A2418' }}>
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>待选物料</h3>
            <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: '1px solid #2A2418' }}>
              <button
                type="button"
                onClick={() => switchPickerMode('raw_material')}
                className="px-3 py-1.5 transition-colors"
                style={{
                  background: pickerMode === 'raw_material' ? 'rgba(201,169,110,0.15)' : 'transparent',
                  color: pickerMode === 'raw_material' ? '#C9A96E' : 'var(--muted-foreground)',
                }}
              >
                原材料
              </button>
              <button
                type="button"
                onClick={() => switchPickerMode('semi_finished')}
                className="px-3 py-1.5 transition-colors"
                style={{
                  background: pickerMode === 'semi_finished' ? 'rgba(201,169,110,0.15)' : 'transparent',
                  color: pickerMode === 'semi_finished' ? '#C9A96E' : 'var(--muted-foreground)',
                }}
              >
                半成品
              </button>
              <button
                type="button"
                onClick={() => switchPickerMode('factory_product')}
                className="px-3 py-1.5 transition-colors"
                style={{
                  background: pickerMode === 'factory_product' ? 'rgba(201,169,110,0.15)' : 'transparent',
                  color: pickerMode === 'factory_product' ? '#C9A96E' : 'var(--muted-foreground)',
                }}
              >
                成品
              </button>
            </div>
          </div>
          {pickerSearch.trim() && (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {pickerMode === 'raw_material'
                ? '正在全部分类中搜索原料'
                : pickerMode === 'semi_finished'
                  ? '正在全部 Sol. 半成品中搜索'
                  : '正在全部成品中搜索'}
            </span>
          )}
        </div>
        <div className="grid lg:grid-cols-[12rem_1fr] min-h-[14rem]">
          <div
            className="border-r overflow-y-auto max-h-72 lg:max-h-80"
            style={{ borderColor: '#2A2418', opacity: pickerSearch.trim() ? 0.45 : 1 }}
          >
            {pickerMode === 'raw_material' ? (
              MATERIAL_ATTRIBUTE_GROUPS.map(group => (
                <button
                  key={group.code}
                  type="button"
                  onClick={() => {
                    setPickerSearch('')
                    setSelectedPickerId(null)
                    setAttributeFilter(group.code)
                  }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  style={{
                    background: !pickerSearch.trim() && attributeFilter === group.code ? 'rgba(201,169,110,0.12)' : 'transparent',
                    color: !pickerSearch.trim() && attributeFilter === group.code ? '#C9A96E' : 'var(--muted-foreground)',
                  }}
                >
                  {group.label}
                </button>
              ))
            ) : pickerMode === 'semi_finished' ? (
              semifinishedCategories.length === 0 ? (
                <p className="px-3 py-4 text-xs" style={{ color: '#5A5040' }}>暂无半成品分类</p>
              ) : (
                semifinishedCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setPickerSearch('')
                      setSelectedPickerId(null)
                      setSemifinishedCategoryFilter(cat.id)
                    }}
                    className="w-full text-left px-3 py-2 text-xs transition-colors"
                    style={{
                      background: !pickerSearch.trim() && semifinishedCategoryFilter === cat.id
                        ? 'rgba(201,169,110,0.12)' : 'transparent',
                      color: !pickerSearch.trim() && semifinishedCategoryFilter === cat.id
                        ? '#C9A96E' : 'var(--muted-foreground)',
                    }}
                  >
                    {cat.name}
                  </button>
                ))
              )
            ) : finishedProductCategories.length === 0 ? (
              <p className="px-3 py-4 text-xs" style={{ color: '#5A5040' }}>暂无产品类别</p>
            ) : (
              finishedProductCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setPickerSearch('')
                    setSelectedPickerId(null)
                    setFinishedProductCategoryFilter(cat.id)
                  }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  style={{
                    background: !pickerSearch.trim() && finishedProductCategoryFilter === cat.id
                      ? 'rgba(201,169,110,0.12)' : 'transparent',
                    color: !pickerSearch.trim() && finishedProductCategoryFilter === cat.id
                      ? '#C9A96E' : 'var(--muted-foreground)',
                  }}
                >
                  {cat.name}
                </button>
              ))
            )}
          </div>
          <div className="p-3 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[12rem]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  value={pickerSearch}
                  onChange={e => {
                    setPickerSearch(e.target.value)
                    setSelectedPickerId(null)
                  }}
                  placeholder={
                    pickerMode === 'raw_material'
                      ? '搜索全部原料（编号、名称、供应商）...'
                      : pickerMode === 'semi_finished'
                        ? '搜索 Sol. 半成品（编号、名称）...'
                        : '搜索成品（编号、名称）...'
                  }
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <button
                type="button"
                onClick={addSelectedPickerItem}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}
              >
                添加选中
              </button>
            </div>
            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              {pickerMode === 'raw_material' ? (
                pickerLoading ? (
                  <p className="text-sm py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>加载原料...</p>
                ) : pickerMaterials.length === 0 ? (
                  <p className="text-sm py-8 text-center" style={{ color: '#5A5040' }}>
                    {pickerSearch.trim() ? '未找到匹配原料' : '该分类下暂无原料'}
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
                        const alreadyAdded = items.some(
                          item => item.itemType === 'raw_material' && item.rawMaterialId === material.id,
                        )
                        return (
                          <tr
                            key={material.id}
                            onClick={() => !alreadyAdded && setSelectedPickerId(material.id)}
                            className={alreadyAdded ? 'opacity-40' : 'cursor-pointer'}
                            style={{
                              background: selectedPickerId === material.id && !alreadyAdded
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
                )
              ) : pickerMode === 'semi_finished' ? (
                pickerLoading ? (
                  <p className="text-sm py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>加载半成品配方...</p>
                ) : displayedSemifinished.length === 0 ? (
                  <p className="text-sm py-8 text-center" style={{ color: '#5A5040' }}>
                    {pickerSearch.trim() ? '未找到匹配半成品配方' : '该分类下暂无半成品配方'}
                  </p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th style={th}>编号</th>
                        <th style={th}>名称</th>
                        <th style={th}>分类</th>
                        <th style={th}>批量</th>
                        <th style={th}>单位成本</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedSemifinished.map(semifinished => {
                        const alreadyAdded = items.some(
                          item => item.itemType === 'recipe' && item.recipeId === semifinished.id,
                        )
                        return (
                          <tr
                            key={semifinished.id}
                            onClick={() => !alreadyAdded && setSelectedPickerId(semifinished.id)}
                            className={alreadyAdded ? 'opacity-40' : 'cursor-pointer'}
                            style={{
                              background: selectedPickerId === semifinished.id && !alreadyAdded
                                ? 'rgba(201,169,110,0.08)'
                                : 'transparent',
                            }}
                          >
                            <td style={td}>{semifinished.code}</td>
                            <td style={td}>{semifinished.name}</td>
                            <td style={td}>{semifinished.category.name}</td>
                            <td style={td}>{formatMoney(semifinished.batchQuantity, 3)}</td>
                            <td style={td}>{formatMoney(semifinished.unitCost)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              ) : pickerLoading ? (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>加载成品...</p>
              ) : displayedFinishedProducts.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: '#5A5040' }}>
                  {pickerSearch.trim() ? '未找到匹配成品' : '该类别下暂无成品'}
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th style={th}>编号</th>
                      <th style={th}>名称</th>
                      <th style={th}>类别</th>
                      <th style={th}>单位</th>
                      <th style={th}>单价</th>
                      <th style={th}>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedFinishedProducts.map(product => {
                      const alreadyAdded = items.some(
                        item => item.itemType === 'factory_product' && item.factoryProductId === product.id,
                      )
                      return (
                        <tr
                          key={product.id}
                          onClick={() => !alreadyAdded && setSelectedPickerId(product.id)}
                          className={alreadyAdded ? 'opacity-40' : 'cursor-pointer'}
                          style={{
                            background: selectedPickerId === product.id && !alreadyAdded
                              ? 'rgba(201,169,110,0.08)'
                              : 'transparent',
                          }}
                        >
                          <td style={td}>{product.productCode}</td>
                          <td style={td}>{product.name}</td>
                          <td style={td}>{product.category?.name ?? '—'}</td>
                          <td style={td}>{product.unit}</td>
                          <td style={td}>{formatMoney(product.unitPrice)}</td>
                          <td style={td}>{product.notes || '—'}</td>
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
  )
}
