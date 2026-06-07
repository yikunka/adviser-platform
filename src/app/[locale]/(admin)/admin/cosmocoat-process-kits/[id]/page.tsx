'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Download, Pencil, Plus, Printer, Save, Trash2 } from 'lucide-react'
import { DatetimeLocalPicker } from '@/components/ui/date-picker-popover'
import { cn } from '@/lib/utils'
import { buildProcessFlowDocument, type ProcessFlowBlock } from '@/lib/cosmocoat/process-flow'
import { CHEMICAL_RESISTANCE_OPTIONS, normalizePerformanceStandards } from '@/lib/cosmocoat/process-kit-standards'

type FactoryProductOption = {
  id: string
  productCode: string
  name: string
  category?: { id: string; name: string; slug: string } | null
}

type KitProduct = {
  id: string
  productId: string
  productName: string
  sortOrder: number
  quantityRatio: string | null
  usageMethod: string
  hardenerProductId: string | null
  hardenerProductName: string | null
  hardenerRatio: string | null
  thinnerProductId: string | null
  thinnerProductName: string | null
  thinnerRatio: string | null
  irMinutes: string | null
  irTemperature: string | null
  uvEnergy: string | null
  filmThickness: string | null
  sprayViscosity: string | null
  notes: string | null
  processBlocks?: ProcessFlowBlock[]
}

type KitTest = {
  id: string
  testType: string
  testResult: string
  testDate: string
  testerName: string
  reportLink: string | null
  testNotes: string | null
  passedAt: string | null
}

type KitStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

type LoadedKit = {
  code: string
  name: string
  description?: string | null
  materials?: string[]
  performanceStandards?: string[]
  otherNote?: string | null
  processDescription?: string | null
  processFlowNote?: string | null
  status: KitStatus
  products?: KitProduct[]
  tests?: KitTest[]
}

const MATERIALS = [
  { id: 'ABS', label: 'ABS' },
  { id: 'SAN', label: 'SAN' },
  { id: 'PC', label: 'PC' },
  { id: 'PC_BF', label: 'PC+ 玻纖' },
  { id: 'PP', label: 'PP' },
  { id: 'PETG', label: 'PETG' },
  { id: 'PET', label: 'PET' },
  { id: 'PCTA', label: 'PCTA' },
  { id: 'PS', label: 'PS' },
  { id: 'PE', label: 'PE' },
  { id: 'PMMA', label: 'PMMA' },
  { id: 'NYLON', label: '尼龍' },
  { id: 'ALUMINUM', label: '鋁合金' },
  { id: 'ZINC', label: '鋅合金' },
  { id: 'STAINLESS_302', label: '302' },
  { id: 'STAINLESS_304', label: '304' },
  { id: 'COPPER', label: '銅' },
  { id: 'GLASS', label: '玻璃' },
  { id: 'OTHER', label: '其他 (需註明)' },
]

const PERFORMANCE_STANDARD_GROUPS = [
  {
    id: 'crosshatch',
    options: [
      { id: 'CROSSHATCH_5B', label: '百格 5B' },
    ],
  },
  {
    id: 'boilingWater',
    options: [
      { id: 'BOILING_WATER_80C30M', label: '80C30M' },
      { id: 'BOILING_WATER_80C60M', label: '80C60M' },
      { id: 'BOILING_WATER_100C30M', label: '100C30M' },
      { id: 'BOILING_WATER_100C60M', label: '100C60M' },
      { id: 'BOILING_WATER_100C120M', label: '100C120M' },
    ],
  },
  {
    id: 'rca',
    options: [
      { id: 'RCA_30', label: '30' },
      { id: 'RCA_50', label: '50' },
      { id: 'RCA_100', label: '100' },
      { id: 'RCA_150', label: '150' },
      { id: 'RCA_200', label: '200' },
    ],
  },
  {
    id: 'hardness',
    options: [
      { id: 'HARDNESS_B', label: 'B' },
      { id: 'HARDNESS_HB', label: 'HB' },
      { id: 'HARDNESS_H', label: 'H' },
      { id: 'HARDNESS_2H', label: '2H' },
    ],
  },
  {
    id: 'chemicalResistance',
    options: [...CHEMICAL_RESISTANCE_OPTIONS],
  },
  {
    id: 'highTempHumiditySaltSpray',
    options: [
      { id: 'HIGH_TEMP_HUMIDITY_SALT_SPRAY', label: '高温高湿/盐雾' },
    ],
  },
]

const MATERIAL_LABELS = new Map(MATERIALS.map(material => [material.id, material.label]))
const PERFORMANCE_STANDARD_LABELS = new Map(
  PERFORMANCE_STANDARD_GROUPS.flatMap(group => group.options.map(option => [option.id, option.label] as const)),
)

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

const PRINT_RESET_DELAY_MS = 180
const PROCESS_KIT_PRINT_AREA_ID = 'cosmocoat-process-kit-print-area'

const PROCESS_KIT_PRINT_STYLES = `
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
    .cosmocoat-process-kit-screen { display: none !important; }

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

    #${PROCESS_KIT_PRINT_AREA_ID} {
      display: block !important;
      width: auto;
      max-width: none;
      box-sizing: border-box;
      padding: 12mm 14mm;
      font-family: 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      color: #000 !important;
      background: #fff !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    #${PROCESS_KIT_PRINT_AREA_ID} * {
      box-sizing: border-box;
      max-width: 100%;
    }

    #${PROCESS_KIT_PRINT_AREA_ID} table {
      table-layout: fixed;
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt !important;
    }

    #${PROCESS_KIT_PRINT_AREA_ID} td,
    #${PROCESS_KIT_PRINT_AREA_ID} th {
      word-break: break-word;
      overflow-wrap: anywhere;
      padding: 4px 6px !important;
      font-size: 9pt !important;
      line-height: 1.35;
      vertical-align: top;
    }

    #${PROCESS_KIT_PRINT_AREA_ID} .print-section-title {
      break-after: avoid;
      page-break-after: avoid;
    }

    #${PROCESS_KIT_PRINT_AREA_ID} tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }

  @media screen {
    #${PROCESS_KIT_PRINT_AREA_ID} { display: none; }
  }
`

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

function matchesAccessoryProduct(product: FactoryProductOption, type: 'hardener' | 'thinner') {
  const text = [
    product.productCode,
    product.name,
    product.category?.name,
    product.category?.slug,
  ].filter(Boolean).join(' ').toLowerCase()

  if (type === 'hardener') {
    return product.productCode.toUpperCase().startsWith('HD') || /hardener|固化剂|固化劑/.test(text)
  }

  return /diluent|thinner|diluent|稀释剂|稀釋劑|稀释|稀釋/.test(text)
}

function displayText(value: string | number | null | undefined) {
  const normalized = value == null ? '' : String(value)
  return normalized.trim() || '—'
}

function sanitizeDownloadFilename(value: string) {
  const sanitized = value.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_')
  return sanitized || 'process-kit'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatPrintDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

const TEST_TYPES = [
  'PERFORMANCE',
  'DURABILITY',
  'ADHESION',
  'COLOR_STABILITY',
  'BOND_STRENGTH',
  'OTHER',
] as const

const TEST_RESULTS = ['PENDING', 'PASSED', 'FAILED'] as const

function ResultBadge({ result, label }: { result: string; label: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
    PASSED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
    FAILED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  }
  const c = colors[result] ?? colors.PENDING
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.text }}>
      {label}
    </span>
  )
}

interface ProcessKitPrintViewProps {
  code: string
  name: string
  description: string
  statusLabel: string
  materialLabels: string[]
  performanceStandardLabels: string[]
  otherNote: string
  processDescription: string
  processFlowNote: string
  processFlowDocument: string
  kitProducts: KitProduct[]
  tests: KitTest[]
  labels: {
    title: string
    basicInfo: string
    code: string
    name: string
    status: string
    description: string
    materials: string
    performanceStandards: string
    processFlowSection: string
    addProcess: string
    globalProcessNote: string
    processFlowDocument: string
    productsSection: string
    productName: string
    hardener: string
    thinner: string
    irParameters: string
    uvEnergy: string
    filmThickness: string
    sprayViscosity: string
    notes: string
    testsSection: string
    testType: string
    testResult: string
    testDate: string
    testerName: string
    reportLink: string
    noProducts: string
    noTests: string
    testTypeLabel: (type: string) => string
    testResultLabel: (result: string) => string
  }
}

function ProcessKitPrintView({
  code,
  name,
  description,
  statusLabel,
  materialLabels,
  performanceStandardLabels,
  otherNote,
  processDescription,
  processFlowNote,
  processFlowDocument,
  kitProducts,
  tests,
  labels,
}: ProcessKitPrintViewProps) {
  return (
    <div id={PROCESS_KIT_PRINT_AREA_ID}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
        {labels.title}
      </div>

      <div className="print-section-title" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, borderLeft: '3px solid #000', paddingLeft: 6 }}>
        {labels.basicInfo}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 9 }}>
        <tbody>
          <tr>
            <td style={{ width: '14%', padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.code}</td>
            <td style={{ width: '36%', padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(code)}</td>
            <td style={{ width: '14%', padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.name}</td>
            <td style={{ width: '36%', padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(name)}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.status}</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(statusLabel)}</td>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.materials}</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(materialLabels.join('、'))}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.performanceStandards}</td>
            <td colSpan={3} style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(performanceStandardLabels.join('、'))}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.description}</td>
            <td colSpan={3} style={{ padding: '3px 6px', border: '1px solid #ccc', whiteSpace: 'pre-wrap' }}>{displayText(description)}</td>
          </tr>
          {otherNote.trim() && (
            <tr>
              <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.notes}</td>
              <td colSpan={3} style={{ padding: '3px 6px', border: '1px solid #ccc', whiteSpace: 'pre-wrap' }}>{displayText(otherNote)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="print-section-title" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, borderLeft: '3px solid #000', paddingLeft: 6 }}>
        {labels.productsSection}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 9 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ width: '6%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'center' }}>#</th>
            <th style={{ width: '21%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.productName}</th>
            <th style={{ width: '16%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.hardener}</th>
            <th style={{ width: '16%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.thinner}</th>
            <th style={{ width: '12%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.irParameters}</th>
            <th style={{ width: '10%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.uvEnergy}</th>
            <th style={{ width: '10%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.filmThickness}</th>
            <th style={{ width: '9%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.sprayViscosity}</th>
          </tr>
        </thead>
        <tbody>
          {kitProducts.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center' }}>{labels.noProducts}</td>
            </tr>
          ) : (
            kitProducts.map((product, index) => (
              <tr key={product.id} style={{ background: index % 2 === 1 ? '#fafafa' : '#fff' }}>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(product.productName)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>
                  {product.hardenerProductName ? `${product.hardenerProductName}${product.hardenerRatio ? ` / ${product.hardenerRatio}` : ''}` : '—'}
                </td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>
                  {product.thinnerProductName ? `${product.thinnerProductName}${product.thinnerRatio ? ` / ${product.thinnerRatio}` : ''}` : '—'}
                </td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(product.irMinutes)} / {displayText(product.irTemperature)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(product.uvEnergy)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(product.filmThickness)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(product.sprayViscosity)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="print-section-title" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, borderLeft: '3px solid #000', paddingLeft: 6 }}>
        {labels.processFlowSection}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 9 }}>
        <tbody>
          {processDescription.trim() && (
            <tr>
              <td style={{ width: '16%', padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.addProcess}</td>
              <td style={{ padding: '3px 6px', border: '1px solid #ccc', whiteSpace: 'pre-wrap' }}>{displayText(processDescription)}</td>
            </tr>
          )}
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.globalProcessNote}</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc', whiteSpace: 'pre-wrap' }}>{displayText(processFlowNote)}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', background: '#f5f5f5', fontWeight: 600, border: '1px solid #ccc' }}>{labels.processFlowDocument}</td>
            <td style={{ padding: '3px 6px', border: '1px solid #ccc', whiteSpace: 'pre-wrap' }}>{displayText(processFlowDocument)}</td>
          </tr>
        </tbody>
      </table>

      <div className="print-section-title" style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, borderLeft: '3px solid #000', paddingLeft: 6 }}>
        {labels.testsSection}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ width: '16%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.testType}</th>
            <th style={{ width: '14%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.testResult}</th>
            <th style={{ width: '20%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.testDate}</th>
            <th style={{ width: '16%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.testerName}</th>
            <th style={{ width: '17%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.reportLink}</th>
            <th style={{ width: '17%', padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>{labels.notes}</th>
          </tr>
        </thead>
        <tbody>
          {tests.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '8px 6px', border: '1px solid #ccc', textAlign: 'center' }}>{labels.noTests}</td>
            </tr>
          ) : (
            tests.map((test, index) => (
              <tr key={test.id} style={{ background: index % 2 === 1 ? '#fafafa' : '#fff' }}>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{labels.testTypeLabel(test.testType)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{labels.testResultLabel(test.testResult)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{formatPrintDateTime(test.testDate)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(test.testerName)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(test.reportLink)}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{displayText(test.testNotes)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminCosmoCoatProcessKitDetailPage() {
  const t = useTranslations('admin.processKits')
  const params = useParams()
  const router = useRouter()
  const kitId = params.id as string
  const isNew = kitId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [products, setProducts] = useState<FactoryProductOption[]>([])

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [selectedPerformanceStandards, setSelectedPerformanceStandards] = useState<string[]>([])
  const [otherNote, setOtherNote] = useState('')
  const [processDescription, setProcessDescription] = useState('')
  const [processFlowNote, setProcessFlowNote] = useState('')
  const [status, setStatus] = useState<KitStatus>('DRAFT')
  const [kitProducts, setKitProducts] = useState<KitProduct[]>([])
  const [tests, setTests] = useState<KitTest[]>([])

  const [showProductForm, setShowProductForm] = useState(false)
  const [addingProduct, setAddingProduct] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [savingProductEdit, setSavingProductEdit] = useState(false)
  const [processEditor, setProcessEditor] = useState<{ productId: string; blockId: string | null; text: string } | null>(null)
  const [savingProcessBlock, setSavingProcessBlock] = useState(false)
  const [editForm, setEditForm] = useState({
    irMinutes: '',
    irTemperature: '',
    uvEnergy: '',
    filmThickness: '',
    notes: '',
  })
  const [productForm, setProductForm] = useState({
    productId: '',
    useHardener: false,
    hardenerProductId: '',
    hardenerRatio: '',
    useThinner: false,
    thinnerProductId: '',
    thinnerRatio: '',
    irMinutes: '',
    irTemperature: '',
    uvEnergy: '',
    filmThickness: '',
    sprayViscosity: '',
    notes: '',
  })

  const [showTestForm, setShowTestForm] = useState(false)
  const [addingTest, setAddingTest] = useState(false)
  const [testForm, setTestForm] = useState({
    testType: 'PERFORMANCE' as typeof TEST_TYPES[number],
    testResult: 'PENDING' as typeof TEST_RESULTS[number],
    testDate: toDatetimeLocal(new Date().toISOString()),
    testerName: '',
    reportLink: '',
    testNotes: '',
  })

  const hasOther = selectedMaterials.includes('OTHER')
  const hardenerProducts = useMemo(
    () => products.filter(product => matchesAccessoryProduct(product, 'hardener')),
    [products],
  )
  const thinnerProducts = useMemo(
    () => products.filter(product => matchesAccessoryProduct(product, 'thinner')),
    [products],
  )
  const processFlowDocument = useMemo(
    () => buildProcessFlowDocument(kitProducts, processFlowNote, processDescription),
    [kitProducts, processFlowNote, processDescription],
  )
  const materialLabels = useMemo(() => {
    const labels = selectedMaterials
      .filter(id => id !== 'OTHER')
      .map(id => MATERIAL_LABELS.get(id) ?? id)
    if (hasOther && otherNote.trim()) labels.push(otherNote.trim())
    return labels
  }, [hasOther, otherNote, selectedMaterials])
  const performanceStandardLabels = useMemo(
    () => selectedPerformanceStandards.map(id => PERFORMANCE_STANDARD_LABELS.get(id) ?? id),
    [selectedPerformanceStandards],
  )
  const printLabels = useMemo(() => ({
    title: t('printTitle'),
    basicInfo: t('basicInfo'),
    code: t('code'),
    name: t('name'),
    status: t('status'),
    description: t('description'),
    materials: t('materials'),
    performanceStandards: t('performanceStandards'),
    processFlowSection: t('processFlowSection'),
    addProcess: t('addProcess'),
    globalProcessNote: t('globalProcessNote'),
    processFlowDocument: t('processFlowDocument'),
    productsSection: t('productsSection'),
    productName: t('productName'),
    hardener: t('hardener'),
    thinner: t('thinner'),
    irParameters: t('irParameters'),
    uvEnergy: t('uvEnergy'),
    filmThickness: t('filmThickness'),
    sprayViscosity: t('sprayViscosity'),
    notes: t('notes'),
    testsSection: t('testsSection'),
    testType: t('testType'),
    testResult: t('testResult'),
    testDate: t('testDate'),
    testerName: t('testerName'),
    reportLink: t('reportLink'),
    noProducts: t('noProducts'),
    noTests: t('noTests'),
    testTypeLabel: (type: string) => t(`testTypes.${type}`),
    testResultLabel: (result: string) => t(`testResults.${result}`),
  }), [t])

  function toggleMaterial(materialId: string) {
    setSelectedMaterials(prev => {
      if (prev.includes(materialId)) {
        if (materialId === 'OTHER') setOtherNote('')
        return prev.filter(id => id !== materialId)
      }
      return [...prev, materialId]
    })
  }

  function togglePerformanceStandard(standardId: string) {
    setSelectedPerformanceStandards(prev =>
      prev.includes(standardId)
        ? prev.filter(id => id !== standardId)
        : [...prev, standardId],
    )
  }

  function parseOptionalText(value: string) {
    const trimmed = value.trim()
    return trimmed || null
  }

  function resetProductForm() {
    setProductForm({
      productId: '',
      useHardener: false,
      hardenerProductId: '',
      hardenerRatio: '',
      useThinner: false,
      thinnerProductId: '',
      thinnerRatio: '',
      irMinutes: '',
      irTemperature: '',
      uvEnergy: '',
      filmThickness: '',
      sprayViscosity: '',
      notes: '',
    })
  }

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cosmocoat/factory-products?limit=500')
      const data = await res.json()
      if (!res.ok) return
      setProducts((data.items ?? []).map((p: FactoryProductOption) => ({
        id: p.id,
        productCode: p.productCode,
        name: p.name,
        category: p.category ?? null,
      })))
    } catch {
      // non-blocking
    }
  }, [])

  const loadKit = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('loadFailed'))
        return
      }
      const kit = data.kit as LoadedKit
      setCode(kit.code)
      setName(kit.name)
      setDescription(kit.description ?? '')
      const loadedMaterials: string[] = kit.materials ?? []
      const loadedOtherNote: string = kit.otherNote ?? ''
      setSelectedMaterials(
        loadedOtherNote ? [...loadedMaterials, 'OTHER'] : loadedMaterials,
      )
      setSelectedPerformanceStandards(normalizePerformanceStandards(kit.performanceStandards ?? []))
      setOtherNote(loadedOtherNote)
      setProcessDescription(kit.processDescription ?? '')
      setProcessFlowNote(kit.processFlowNote ?? '')
      setStatus(kit.status)
      setKitProducts(kit.products ?? [])
      setTests(kit.tests ?? [])
    } catch {
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [isNew, kitId, t])

  useEffect(() => {
    loadProducts()
    if (isNew) setLoading(false)
  }, [loadProducts, isNew])

  useEffect(() => {
    if (!isNew) loadKit()
  }, [isNew, loadKit])

  async function saveKit() {
    if (!name.trim()) {
      toast.error(t('nameRequired'))
      return
    }

    if (selectedMaterials.length === 0) {
      toast.error(t('materialRequired'))
      return
    }

    if (hasOther && !otherNote.trim()) {
      toast.error(t('otherNoteRequired'))
      return
    }

    setSaving(true)
    const kitData = {
      name: name.trim(),
      description: description.trim() || null,
      materials: selectedMaterials.filter(id => id !== 'OTHER'),
      performanceStandards: normalizePerformanceStandards(selectedPerformanceStandards),
      otherNote: hasOther && otherNote.trim() ? otherNote.trim() : null,
      processDescription: processDescription.trim() || null,
      processFlowNote: processFlowNote.trim() || null,
      ...(isNew
        ? {
            products: kitProducts.map((product, index) => ({
              productId: product.productId,
              sortOrder: index,
              hardenerProductId: product.hardenerProductId,
              hardenerRatio: product.hardenerRatio,
              thinnerProductId: product.thinnerProductId,
              thinnerRatio: product.thinnerRatio,
              irMinutes: product.irMinutes,
              irTemperature: product.irTemperature,
              uvEnergy: product.uvEnergy,
              filmThickness: product.filmThickness,
              sprayViscosity: product.sprayViscosity,
              notes: product.notes,
              processBlocks: product.processBlocks ?? [],
            })),
          }
        : {}),
      ...(!isNew ? { status } : {}),
    }
    const payload = isNew
      ? { code: code.trim() || undefined, ...kitData }
      : kitData

    try {
      const res = await fetch(
        isNew ? '/api/admin/cosmocoat/process-kits' : `/api/admin/cosmocoat/process-kits/${kitId}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('saveFailed'))
        return
      }
      toast.success(isNew ? t('created') : t('saved'))
      if (isNew && data.kit?.id) {
        router.replace(`/admin/cosmocoat-process-kits/${data.kit.id}`)
      } else {
        loadKit()
      }
    } catch {
      toast.error(t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  function printProcessKit() {
    setPrinting(true)
    window.setTimeout(() => {
      window.print()
      window.setTimeout(() => setPrinting(false), PRINT_RESET_DELAY_MS)
    }, 0)
  }

  function downloadProcessKitWord() {
    const printArea = document.getElementById(PROCESS_KIT_PRINT_AREA_ID)
    if (!printArea) {
      toast.error(t('downloadFailed'))
      return
    }

    const filename = `${sanitizeDownloadFilename(code || name || 'process-kit')}-工艺书.doc`
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(`${displayText(code)} ${displayText(name)}`)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    body {
      margin: 0;
      font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      color: #000;
      background: #fff;
    }
    * { box-sizing: border-box; max-width: 100%; }
    table { table-layout: fixed; width: 100%; border-collapse: collapse; font-size: 9pt; }
    td, th {
      word-break: break-word;
      overflow-wrap: anywhere;
      padding: 4px 6px;
      font-size: 9pt;
      line-height: 1.35;
      vertical-align: top;
    }
    .print-section-title {
      font-weight: 700;
      font-size: 11pt;
      margin-bottom: 5px;
      border-left: 3px solid #000;
      padding-left: 6px;
    }
  </style>
</head>
<body>${printArea.innerHTML}</body>
</html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function addProduct() {
    const irMinutes = parseOptionalText(productForm.irMinutes)
    const irTemperature = parseOptionalText(productForm.irTemperature)
    const uvEnergy = parseOptionalText(productForm.uvEnergy)
    const filmThickness = parseOptionalText(productForm.filmThickness)
    const sprayViscosity = parseOptionalText(productForm.sprayViscosity)

    if (!productForm.productId) {
      toast.error(t('productFormRequired'))
      return
    }

    if (
      (productForm.useHardener && (!productForm.hardenerProductId || !productForm.hardenerRatio.trim())) ||
      (productForm.useThinner && (!productForm.thinnerProductId || !productForm.thinnerRatio.trim()))
    ) {
      toast.error(t('accessoryFormRequired'))
      return
    }

    const selectedProduct = products.find(product => product.id === productForm.productId)
    const selectedHardener = productForm.useHardener
      ? products.find(product => product.id === productForm.hardenerProductId)
      : null
    const selectedThinner = productForm.useThinner
      ? products.find(product => product.id === productForm.thinnerProductId)
      : null
    if (isNew) {
      setKitProducts(prev => [
        ...prev,
        {
          id: `draft-${Date.now()}-${prev.length}`,
          productId: productForm.productId,
          productName: selectedProduct ? `${selectedProduct.productCode} · ${selectedProduct.name}` : productForm.productId,
          sortOrder: prev.length,
          quantityRatio: null,
          usageMethod: '',
          hardenerProductId: productForm.useHardener ? productForm.hardenerProductId : null,
          hardenerProductName: selectedHardener ? `${selectedHardener.productCode} · ${selectedHardener.name}` : null,
          hardenerRatio: productForm.useHardener ? productForm.hardenerRatio.trim() : null,
          thinnerProductId: productForm.useThinner ? productForm.thinnerProductId : null,
          thinnerProductName: selectedThinner ? `${selectedThinner.productCode} · ${selectedThinner.name}` : null,
          thinnerRatio: productForm.useThinner ? productForm.thinnerRatio.trim() : null,
          irMinutes,
          irTemperature,
          uvEnergy,
          filmThickness,
          sprayViscosity,
          notes: productForm.notes.trim() || null,
          processBlocks: [],
        },
      ])
      resetProductForm()
      setShowProductForm(false)
      return
    }

    setAddingProduct(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: productForm.productId,
          hardenerProductId: productForm.useHardener ? productForm.hardenerProductId : null,
          hardenerRatio: productForm.useHardener ? productForm.hardenerRatio.trim() : null,
          thinnerProductId: productForm.useThinner ? productForm.thinnerProductId : null,
          thinnerRatio: productForm.useThinner ? productForm.thinnerRatio.trim() : null,
          irMinutes,
          irTemperature,
          uvEnergy,
          filmThickness,
          sprayViscosity,
          notes: productForm.notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('addProductFailed'))
        return
      }
      toast.success(t('productAdded'))
      setKitProducts(data.kit?.products ?? [])
      resetProductForm()
      setShowProductForm(false)
    } catch {
      toast.error(t('addProductFailed'))
    } finally {
      setAddingProduct(false)
    }
  }

  function resetEditForm() {
    setEditingProductId(null)
    setEditForm({
      irMinutes: '',
      irTemperature: '',
      uvEnergy: '',
      filmThickness: '',
      notes: '',
    })
  }

  function startEditProduct(product: KitProduct) {
    setShowProductForm(false)
    setEditingProductId(product.id)
    setEditForm({
      irMinutes: product.irMinutes ?? '',
      irTemperature: product.irTemperature ?? '',
      uvEnergy: product.uvEnergy ?? '',
      filmThickness: product.filmThickness ?? '',
      notes: product.notes ?? '',
    })
  }

  async function saveProductEdit() {
    if (!editingProductId) return

    const irMinutes = parseOptionalText(editForm.irMinutes)
    const irTemperature = parseOptionalText(editForm.irTemperature)
    const uvEnergy = parseOptionalText(editForm.uvEnergy)
    const filmThickness = parseOptionalText(editForm.filmThickness)

    if (isNew) {
      setKitProducts(prev => prev.map(product =>
        product.id === editingProductId
          ? {
              ...product,
              irMinutes,
              irTemperature,
              uvEnergy,
              filmThickness,
              notes: editForm.notes.trim() || null,
            }
          : product,
      ))
      toast.success(t('productUpdated'))
      resetEditForm()
      return
    }

    setSavingProductEdit(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}/products`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingProductId,
          irMinutes,
          irTemperature,
          uvEnergy,
          filmThickness,
          notes: editForm.notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('editProductFailed'))
        return
      }
      toast.success(t('productUpdated'))
      setKitProducts(data.kit?.products ?? [])
      resetEditForm()
    } catch {
      toast.error(t('editProductFailed'))
    } finally {
      setSavingProductEdit(false)
    }
  }

  async function removeProduct(productId: string) {
    if (!window.confirm(t('removeProductConfirm'))) return
    if (editingProductId === productId) resetEditForm()
    if (processEditor?.productId === productId) setProcessEditor(null)
    if (isNew) {
      setKitProducts(prev => prev.filter(product => product.id !== productId))
      return
    }
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}/products`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('removeProductFailed'))
        return
      }
      toast.success(t('productRemoved'))
      setKitProducts(data.kit?.products ?? [])
    } catch {
      toast.error(t('removeProductFailed'))
    }
  }

  function createProcessBlockId() {
    return `process-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function startAddProcessBlock(productId: string) {
    setProcessEditor({ productId, blockId: null, text: '' })
  }

  function startEditProcessBlock(productId: string, block: ProcessFlowBlock) {
    setProcessEditor({ productId, blockId: block.id, text: block.text })
  }

  async function persistProductProcessBlocks(productId: string, processBlocks: ProcessFlowBlock[]) {
    if (isNew) {
      setKitProducts(prev => prev.map(product =>
        product.id === productId ? { ...product, processBlocks } : product,
      ))
      return true
    }

    setSavingProcessBlock(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}/products`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId, processBlocks }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('processBlockSaveFailed'))
        return false
      }
      setKitProducts(data.kit?.products ?? [])
      return true
    } catch {
      toast.error(t('processBlockSaveFailed'))
      return false
    } finally {
      setSavingProcessBlock(false)
    }
  }

  async function saveProcessBlock() {
    if (!processEditor) return
    const text = processEditor.text.trim()
    if (!text) {
      toast.error(t('processBlockRequired'))
      return
    }

    const product = kitProducts.find(item => item.id === processEditor.productId)
    if (!product) return

    const currentBlocks = product.processBlocks ?? []
    const nextBlocks = processEditor.blockId
      ? currentBlocks.map(block =>
          block.id === processEditor.blockId ? { ...block, text } : block,
        )
      : [...currentBlocks, { id: createProcessBlockId(), text }]

    const saved = await persistProductProcessBlocks(product.id, nextBlocks)
    if (!saved) return
    toast.success(processEditor.blockId ? t('processBlockUpdated') : t('processBlockAdded'))
    setProcessEditor(null)
  }

  async function removeProcessBlock(productId: string, blockId: string) {
    if (!window.confirm(t('removeProcessBlockConfirm'))) return
    const product = kitProducts.find(item => item.id === productId)
    if (!product) return
    const nextBlocks = (product.processBlocks ?? []).filter(block => block.id !== blockId)
    const saved = await persistProductProcessBlocks(productId, nextBlocks)
    if (!saved) return
    if (processEditor?.productId === productId && processEditor.blockId === blockId) setProcessEditor(null)
    toast.success(t('processBlockRemoved'))
  }

  async function addTest() {
    if (!testForm.testerName.trim()) {
      toast.error(t('testerRequired'))
      return
    }
    const testDate = fromDatetimeLocal(testForm.testDate)
    if (!testDate) {
      toast.error(t('testDateRequired'))
      return
    }

    setAddingTest(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/process-kits/${kitId}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType: testForm.testType,
          testResult: testForm.testResult,
          testDate,
          testerName: testForm.testerName.trim(),
          reportLink: testForm.reportLink,
          testNotes: testForm.testNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('addTestFailed'))
        return
      }
      toast.success(t('testAdded'))
      setTests(data.kit?.tests ?? [])
      setTestForm({
        testType: 'PERFORMANCE',
        testResult: 'PENDING',
        testDate: toDatetimeLocal(new Date().toISOString()),
        testerName: '',
        reportLink: '',
        testNotes: '',
      })
      setShowTestForm(false)
    } catch {
      toast.error(t('addTestFailed'))
    } finally {
      setAddingTest(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('loading')}</div>
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PROCESS_KIT_PRINT_STYLES }} />
      {!isNew && (
        <ProcessKitPrintView
          code={code}
          name={name}
          description={description}
          statusLabel={t(`statuses.${status}`)}
          materialLabels={materialLabels}
          performanceStandardLabels={performanceStandardLabels}
          otherNote={otherNote}
          processDescription={processDescription}
          processFlowNote={processFlowNote}
          processFlowDocument={processFlowDocument}
          kitProducts={kitProducts}
          tests={tests}
          labels={printLabels}
        />
      )}
      <div className="cosmocoat-process-kit-screen p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-process-kits" className="p-2 rounded-lg" style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? t('createTitle') : t('detailTitle')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {isNew ? t('createSubtitle') : `${code} · ${name}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && (
            <>
              <button
                type="button"
                onClick={printProcessKit}
                disabled={printing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
              >
                <Printer size={14} /> {printing ? t('printing') : t('print')}
              </button>
              <button
                type="button"
                onClick={downloadProcessKitWord}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid #2A2418', color: 'var(--foreground)' }}
              >
                <Download size={14} /> {t('download')}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={saveKit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: '#C9A96E', color: '#0A0805' }}
          >
            <Save size={14} /> {saving ? t('saving') : (isNew ? t('create') : t('save'))}
          </button>
        </div>
      </div>

      <div style={card} className="p-4 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{t('basicInfo')}</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('code')}</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              readOnly={!isNew}
              placeholder={isNew ? t('codePlaceholder') : undefined}
              className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none ${!isNew ? 'opacity-70' : ''}`}
              style={inputStyle()}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('name')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('status')}</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as KitStatus)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle()}
            >
              <option value="DRAFT">{t('statuses.DRAFT')}</option>
              <option value="ACTIVE">{t('statuses.ACTIVE')}</option>
              <option value="ARCHIVED">{t('statuses.ARCHIVED')}</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('materials')}</label>
            <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('selectMaterialsHint')}</p>
            <div className="flex flex-wrap gap-2">
              {MATERIALS.map(material => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => toggleMaterial(material.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs transition-all border',
                    selectedMaterials.includes(material.id)
                      ? 'bg-[#C9A96E] border-[#C9A96E] text-[#0A0805]'
                      : 'bg-[#0E0E0A] border-[#2A2418] text-[var(--muted-foreground)] hover:border-[#4A4030]',
                  )}
                >
                  {material.label}
                </button>
              ))}
            </div>
            {hasOther && (
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  {t('otherNoteLabel')}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={otherNote}
                  onChange={e => setOtherNote(e.target.value)}
                  placeholder={t('otherNotePlaceholder')}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
            )}
          </div>
          <div className="space-y-2 sm:col-span-3">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('performanceStandards')}</label>
            <div className="grid gap-3 lg:grid-cols-2">
              {PERFORMANCE_STANDARD_GROUPS.map(group => (
                <div key={group.id} className="rounded-lg p-3" style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}>
                  <p className="mb-2 text-xs font-medium" style={{ color: '#C9A96E' }}>{t(`performanceGroups.${group.id}`)}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => togglePerformanceStandard(option.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs transition-all border',
                          selectedPerformanceStandards.includes(option.id)
                            ? 'bg-[#C9A96E] border-[#C9A96E] text-[#0A0805]'
                            : 'bg-[#111108] border-[#2A2418] text-[var(--muted-foreground)] hover:border-[#4A4030]',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: '#2A2418' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{t('processFlowSection')}</h3>
          <button
            type="button"
            onClick={() => {
              resetEditForm()
              setShowProductForm(v => !v)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
          >
            <Plus size={13} /> {t('addProduct')}
          </button>
        </div>

        {showProductForm && (
          <div className="p-4 border-b space-y-3" style={{ borderColor: '#2A2418', background: '#0E0E0A' }}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('selectProduct')}</label>
                <select
                  value={productForm.productId}
                  onChange={e => setProductForm(f => ({ ...f, productId: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                >
                  <option value="">{t('selectProductPlaceholder')}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.productCode} · {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3 sm:col-span-2 lg:col-span-4">
                <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={productForm.useHardener}
                    onChange={e => setProductForm(f => ({
                      ...f,
                      useHardener: e.target.checked,
                      hardenerProductId: e.target.checked ? f.hardenerProductId : '',
                      hardenerRatio: e.target.checked ? f.hardenerRatio : '',
                    }))}
                    className="h-4 w-4 rounded border-[#2A2418]"
                  />
                  {t('useHardener')}
                </label>
                {productForm.useHardener && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('hardenerProduct')}</label>
                      <select
                        value={productForm.hardenerProductId}
                        onChange={e => setProductForm(f => ({ ...f, hardenerProductId: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={inputStyle()}
                      >
                        <option value="">{t('selectHardenerPlaceholder')}</option>
                        {hardenerProducts.map(p => (
                          <option key={p.id} value={p.id}>{p.productCode} · {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('hardenerRatio')}</label>
                      <input
                        value={productForm.hardenerRatio}
                        onChange={e => setProductForm(f => ({ ...f, hardenerRatio: e.target.value }))}
                        placeholder={t('ratioPlaceholder')}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={inputStyle()}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3 sm:col-span-2 lg:col-span-4">
                <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  <input
                    type="checkbox"
                    checked={productForm.useThinner}
                    onChange={e => setProductForm(f => ({
                      ...f,
                      useThinner: e.target.checked,
                      thinnerProductId: e.target.checked ? f.thinnerProductId : '',
                      thinnerRatio: e.target.checked ? f.thinnerRatio : '',
                    }))}
                    className="h-4 w-4 rounded border-[#2A2418]"
                  />
                  {t('useThinner')}
                </label>
                {productForm.useThinner && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('thinnerProduct')}</label>
                      <select
                        value={productForm.thinnerProductId}
                        onChange={e => setProductForm(f => ({ ...f, thinnerProductId: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={inputStyle()}
                      >
                        <option value="">{t('selectThinnerPlaceholder')}</option>
                        {thinnerProducts.map(p => (
                          <option key={p.id} value={p.id}>{p.productCode} · {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('thinnerRatio')}</label>
                      <input
                        value={productForm.thinnerRatio}
                        onChange={e => setProductForm(f => ({ ...f, thinnerRatio: e.target.value }))}
                        placeholder={t('ratioPlaceholder')}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={inputStyle()}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('irMinutes')}</label>
                <input
                  type="text"
                  value={productForm.irMinutes}
                  onChange={e => setProductForm(f => ({ ...f, irMinutes: e.target.value }))}
                  placeholder={t('parameterRangePlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('irTemperature')}</label>
                <input
                  type="text"
                  value={productForm.irTemperature}
                  onChange={e => setProductForm(f => ({ ...f, irTemperature: e.target.value }))}
                  placeholder={t('parameterRangePlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('uvEnergy')}</label>
                <input
                  type="text"
                  value={productForm.uvEnergy}
                  onChange={e => setProductForm(f => ({ ...f, uvEnergy: e.target.value }))}
                  placeholder={t('parameterRangePlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('filmThickness')}</label>
                <input
                  type="text"
                  value={productForm.filmThickness}
                  onChange={e => setProductForm(f => ({ ...f, filmThickness: e.target.value }))}
                  placeholder={t('filmThicknessPlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('sprayViscosity')}</label>
                <input
                  type="text"
                  value={productForm.sprayViscosity}
                  onChange={e => setProductForm(f => ({ ...f, sprayViscosity: e.target.value }))}
                  placeholder={t('sprayViscosityPlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('notes')}</label>
                <input
                  value={productForm.notes}
                  onChange={e => setProductForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addProduct}
                disabled={addingProduct}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ background: '#C9A96E', color: '#0A0805' }}
              >
                {addingProduct ? t('saving') : t('confirmAdd')}
              </button>
              <button
                type="button"
                onClick={() => setShowProductForm(false)}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {editingProductId && (
          <div className="p-4 border-b space-y-3" style={{ borderColor: '#2A2418', background: '#0E0E0A' }}>
            <p className="text-xs font-medium" style={{ color: '#C9A96E' }}>
              {t('editProductTitle')} — {kitProducts.find(p => p.id === editingProductId)?.productName}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('irMinutes')}</label>
                <input
                  type="text"
                  value={editForm.irMinutes}
                  onChange={e => setEditForm(f => ({ ...f, irMinutes: e.target.value }))}
                  placeholder={t('parameterRangePlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('irTemperature')}</label>
                <input
                  type="text"
                  value={editForm.irTemperature}
                  onChange={e => setEditForm(f => ({ ...f, irTemperature: e.target.value }))}
                  placeholder={t('parameterRangePlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('uvEnergy')}</label>
                <input
                  type="text"
                  value={editForm.uvEnergy}
                  onChange={e => setEditForm(f => ({ ...f, uvEnergy: e.target.value }))}
                  placeholder={t('parameterRangePlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('filmThickness')}</label>
                <input
                  type="text"
                  value={editForm.filmThickness}
                  onChange={e => setEditForm(f => ({ ...f, filmThickness: e.target.value }))}
                  placeholder={t('filmThicknessPlaceholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('notes')}</label>
                <input
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle()}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveProductEdit}
                disabled={savingProductEdit}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ background: '#C9A96E', color: '#0A0805' }}
              >
                {savingProductEdit ? t('saving') : t('confirmEdit')}
              </button>
              <button
                type="button"
                onClick={resetEditForm}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>{t('productName')}</th>
                <th style={th}>{t('hardener')}</th>
                <th style={th}>{t('thinner')}</th>
                <th style={th}>{t('irParameters')}</th>
                <th style={th}>{t('uvEnergy')}</th>
                <th style={th}>{t('filmThickness')}</th>
                <th style={th}>{t('sprayViscosity')}</th>
                <th style={th}>{t('notes')}</th>
                <th style={{ ...th, textAlign: 'right' }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {kitProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...td, textAlign: 'center', padding: '2rem' }}>{t('noProducts')}</td>
                </tr>
              ) : kitProducts.map((p, index) => (
                <tr key={p.id}>
                  <td style={td}>{index + 1}</td>
                  <td style={{ ...td, color: 'var(--foreground)' }}>{p.productName}</td>
                  <td style={td}>{p.hardenerProductName ? `${p.hardenerProductName}${p.hardenerRatio ? ` / ${p.hardenerRatio}` : ''}` : '-'}</td>
                  <td style={td}>{p.thinnerProductName ? `${p.thinnerProductName}${p.thinnerRatio ? ` / ${p.thinnerRatio}` : ''}` : '-'}</td>
                  <td style={td}>{p.irMinutes ?? '-'} / {p.irTemperature ?? '-'}</td>
                  <td style={td}>{p.uvEnergy ?? '-'}</td>
                  <td style={td}>{p.filmThickness ?? '-'}</td>
                  <td style={td}>{p.sprayViscosity ?? '-'}</td>
                  <td style={td}>{p.notes || '-'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEditProduct(p)}
                        title={t('editProduct')}
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: editingProductId === p.id ? '#C9A96E' : 'var(--muted-foreground)' }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeProduct(p.id)}
                        title={t('removeProduct')}
                        className="p-1.5 rounded-md transition-colors"
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

        <div className="p-4 border-t space-y-4" style={{ borderColor: '#2A2418' }}>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('globalProcessNote')}</label>
            <textarea
              value={processFlowNote}
              onChange={e => setProcessFlowNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
              style={inputStyle()}
              placeholder={t('globalProcessNotePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('processFlowDocument')}</label>
            <div className="rounded-lg p-3 text-sm" style={{ ...inputStyle(), minHeight: 160 }}>
              {!processFlowDocument ? (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('processFlowEmptyDocument')}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold" style={{ color: '#C9A96E' }}>完整工艺流程</p>
                  {processDescription.trim() && (
                    <p className="whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                      工艺：{processDescription.trim()}
                    </p>
                  )}
                  {kitProducts.map((product, index) => {
                    const processBlocks = product.processBlocks ?? []
                    const isEditingThisProduct = processEditor?.productId === product.id
                    const activeProcessEditor = isEditingThisProduct ? processEditor : null
                    return (
                      <div
                        key={product.id}
                        className="group relative rounded-lg p-3 transition-colors"
                        style={{ background: '#0E0E0A', border: '1px solid #2A2418' }}
                      >
                        <div className="space-y-1 pr-0 sm:pr-44">
                          <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                            {index + 1}. 产品：{product.productName}
                          </p>
                          {product.hardenerProductName && (
                            <p style={{ color: 'var(--muted-foreground)' }}>
                              HD Hardener固化剂：{product.hardenerProductName}
                              {product.hardenerRatio ? ` / ${product.hardenerRatio}` : ''}
                            </p>
                          )}
                          {product.thinnerProductName && (
                            <p style={{ color: 'var(--muted-foreground)' }}>
                              Diluent稀释剂：{product.thinnerProductName}
                              {product.thinnerRatio ? ` / ${product.thinnerRatio}` : ''}
                            </p>
                          )}
                          <p style={{ color: 'var(--muted-foreground)' }}>
                            IR：{product.irMinutes ?? '-'} / {product.irTemperature ?? '-'}
                          </p>
                          {product.uvEnergy && <p style={{ color: 'var(--muted-foreground)' }}>UV能量：{product.uvEnergy}</p>}
                          {product.filmThickness && <p style={{ color: 'var(--muted-foreground)' }}>膜厚：{product.filmThickness}</p>}
                          {product.sprayViscosity && <p style={{ color: 'var(--muted-foreground)' }}>噴塗粘度 2#杯/25C：{product.sprayViscosity}</p>}
                          {product.notes && <p style={{ color: 'var(--muted-foreground)' }}>备注：{product.notes}</p>}
                        </div>

                        {processBlocks.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {processBlocks.map((block, blockIndex) => (
                              <div
                                key={block.id}
                                className="flex items-start justify-between gap-3 rounded-lg px-3 py-2"
                                style={{ background: '#15150F', border: '1px solid #2A2418' }}
                              >
                                <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--foreground)' }}>
                                  工艺{blockIndex + 1}：{block.text}
                                </p>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEditProcessBlock(product.id, block)}
                                    title={t('editProcessBlock')}
                                    className="p-1.5 rounded-md transition-colors"
                                    style={{ color: 'var(--muted-foreground)' }}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeProcessBlock(product.id, block.id)}
                                    title={t('removeProcessBlock')}
                                    className="p-1.5 rounded-md transition-colors"
                                    style={{ color: '#ef4444' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {isEditingThisProduct ? (
                          <div className="mt-3 space-y-2 rounded-lg p-3" style={{ background: '#111108', border: '1px solid #2A2418' }}>
                            <textarea
                              value={activeProcessEditor?.text ?? ''}
                              onChange={e => setProcessEditor(editor => editor ? { ...editor, text: e.target.value } : editor)}
                              rows={3}
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
                              style={inputStyle()}
                              placeholder={t('processBlockPlaceholder')}
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={saveProcessBlock}
                                disabled={savingProcessBlock}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                                style={{ background: '#C9A96E', color: '#0A0805' }}
                              >
                                <Save size={13} /> {savingProcessBlock
                                  ? t('saving')
                                  : activeProcessEditor?.blockId
                                    ? t('confirmEdit')
                                    : t('addToProcessDocument')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setProcessEditor(null)}
                                className="px-3 py-1.5 rounded-lg text-xs"
                                style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
                              >
                                {t('cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => startAddProcessBlock(product.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                              style={{ background: '#1A1A12', border: '1px solid #C9A96E', color: '#C9A96E' }}
                            >
                              <Plus size={13} /> {t('addProcessUnderProduct')}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {processFlowNote.trim() && (
                    <p className="whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                      全局备注：{processFlowNote.trim()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isNew && (
        <>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: '#2A2418' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{t('testsSection')}</h3>
              <button
                type="button"
                onClick={() => setShowTestForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
              >
                <Plus size={13} /> {t('addTest')}
              </button>
            </div>

            {showTestForm && (
              <div className="p-4 border-b space-y-3" style={{ borderColor: '#2A2418', background: '#0E0E0A' }}>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testType')}</label>
                    <select
                      value={testForm.testType}
                      onChange={e => setTestForm(f => ({ ...f, testType: e.target.value as typeof TEST_TYPES[number] }))}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    >
                      {TEST_TYPES.map(type => (
                        <option key={type} value={type}>{t(`testTypes.${type}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testResult')}</label>
                    <select
                      value={testForm.testResult}
                      onChange={e => setTestForm(f => ({ ...f, testResult: e.target.value as typeof TEST_RESULTS[number] }))}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    >
                      {TEST_RESULTS.map(r => (
                        <option key={r} value={r}>{t(`testResults.${r}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testDate')}</label>
                    <DatetimeLocalPicker
                      value={testForm.testDate}
                      onChange={v => setTestForm(f => ({ ...f, testDate: v }))}
                      datePlaceholder={t('selectDate')}
                      dateTriggerStyle={{ ...dateTimePickerStyle, width: '100%', padding: '0.5rem 0.75rem' }}
                      timeInputStyle={dateTimePickerStyle}
                      timeInputClassName="outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testerName')}</label>
                    <input
                      value={testForm.testerName}
                      onChange={e => setTestForm(f => ({ ...f, testerName: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('reportLink')}</label>
                    <input
                      value={testForm.reportLink}
                      onChange={e => setTestForm(f => ({ ...f, reportLink: e.target.value }))}
                      placeholder="https://"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle()}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('testNotes')}</label>
                    <textarea
                      value={testForm.testNotes}
                      onChange={e => setTestForm(f => ({ ...f, testNotes: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
                      style={inputStyle()}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addTest}
                    disabled={addingTest}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: '#C9A96E', color: '#0A0805' }}
                  >
                    {addingTest ? t('saving') : t('confirmAdd')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTestForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ border: '1px solid #2A2418', color: 'var(--muted-foreground)' }}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th style={th}>{t('testType')}</th>
                    <th style={th}>{t('testResult')}</th>
                    <th style={th}>{t('testDate')}</th>
                    <th style={th}>{t('testerName')}</th>
                    <th style={th}>{t('reportLink')}</th>
                    <th style={th}>{t('testNotes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...td, textAlign: 'center', padding: '2rem' }}>{t('noTests')}</td>
                    </tr>
                  ) : tests.map(test => (
                    <tr key={test.id}>
                      <td style={td}>{t(`testTypes.${test.testType}`)}</td>
                      <td style={td}>
                        <ResultBadge result={test.testResult} label={t(`testResults.${test.testResult}`)} />
                      </td>
                      <td style={td}>{new Date(test.testDate).toLocaleString()}</td>
                      <td style={td}>{test.testerName}</td>
                      <td style={td}>
                        {test.reportLink
                          ? <a href={test.reportLink} target="_blank" rel="noreferrer" className="underline" style={{ color: '#C9A96E' }}>{t('viewReport')}</a>
                          : '—'}
                      </td>
                      <td style={td}>{test.testNotes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isNew && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('saveFirstHint')}</p>
      )}
      </div>
    </>
  )
}
