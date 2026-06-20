'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, ImagePlus, PlayCircle, Plus, Printer, Save, Search, X } from 'lucide-react'
import { ProcessKitCombobox } from '@/components/cosmocoat/ProcessKitCombobox'
import {
  PROCESS_KIT_MATERIALS,
  formatProcessKitMaterialsSummary,
  formatProcessKitProductsSummary,
} from '@/lib/cosmocoat/process-kit-materials'
import {
  formatPerformanceStandardLabels,
  getPerformanceStandardLabel,
} from '@/lib/cosmocoat/process-kit-standards'
import { formatMoney, formatPercent, formatWeight } from '@/lib/cosmocoat/recipes'
import {
  displayProcessParameter,
  formatFilmThickness,
  formatIrMinutes,
  formatIrTemperature,
  formatSprayViscosity,
  formatUvEnergy,
} from '@/lib/cosmocoat/process-kit-parameters'
import type { SampleOrderRow } from '@/lib/cosmocoat/sample-orders'

type CustomerOption = { id: string; code: string; name: string }
type EmployeeOption = {
  id: string
  code: string
  name: string
  employeeType: string
  position: string | null
  department: string | null
  phone: string | null
  email: string | null
  isActive: boolean
}
type ProcessKitOption = { id: string; code: string; name: string; status: string; materials: string[]; otherNote: string | null }

type ProcessKitProductRow = {
  id: string
  productName: string
  irMinutes: string | null
  irTemperature: string | null
  uvEnergy: string | null
  filmThickness: string | null
  sprayViscosity: string | null
}

type ProcessKitDetail = {
  materials: string[]
  otherNote: string | null
  performanceStandards: string[]
  processFlowDocument: string
  products: ProcessKitProductRow[]
}

type ProcessKitLine = {
  key: string
  processKitId: string
  code: string
  name: string
  notes: string
  detail: ProcessKitDetail | null
  loading?: boolean
}

type ColorFormulaOption = {
  id: string
  code: string
  name: string
  categoryLabel: string
  targetColor: string
  unitCost: number | null
}

type ColorFormulaLine = {
  key: string
  colorFormulaId: string
  code: string
  name: string
  categoryLabel: string
  unitCost: number | null
  quantityKg: string
  notes: string
}

const SUBSTRATE_OPTIONS = PROCESS_KIT_MATERIALS
  .filter(material => material.id !== 'OTHER')
  .map(material => material.label)
const SAMPLE_KIND_OPTIONS = ['调色种类', 'UV种类', '性能测试'] as const

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

const STATUS_LABEL = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
} as const

function inputStyle(): React.CSSProperties {
  return {
    background: '#0E0E0A',
    border: '1px solid #2A2418',
    color: 'var(--foreground)',
  }
}

function newKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function formatDatetime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatFormulaLineTotalCost(line: ColorFormulaLine): string {
  const quantityKg = Number(line.quantityKg)
  if (line.unitCost == null || !Number.isFinite(quantityKg) || quantityKg <= 0) return '—'
  return formatMoney(line.unitCost * quantityKg)
}

function formatEmployeeOption(employee: EmployeeOption | null | undefined): string {
  if (!employee) return '—'
  return `${employee.code} · ${employee.name}${employee.isActive ? '' : '（停用）'}`
}

function mergeEmployeeOption(options: EmployeeOption[], employee: EmployeeOption | null | undefined) {
  if (!employee || options.some(option => option.id === employee.id)) return options
  return [employee, ...options]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {children}
    </div>
  )
}

type ProcessKitDetailSource = {
  materials?: readonly string[] | null
  otherNote?: string | null
  performanceStandards?: readonly string[] | null
  processFlowDocument?: string | null
  products?: readonly {
    id: string
    productName: string
    irMinutes?: string | null
    irTemperature?: string | null
    uvEnergy?: string | null
    filmThickness?: string | null
    sprayViscosity?: string | null
  }[] | null
}

function extractProcessKitDetail(kit: ProcessKitDetailSource): ProcessKitDetail {
  return {
    materials: [...(kit.materials ?? [])],
    otherNote: kit.otherNote ?? null,
    performanceStandards: [...(kit.performanceStandards ?? [])],
    processFlowDocument: kit.processFlowDocument ?? '',
    products: (kit.products ?? []).map(p => ({
      id: p.id,
      productName: p.productName,
      irMinutes: p.irMinutes ?? null,
      irTemperature: p.irTemperature ?? null,
      uvEnergy: p.uvEnergy ?? null,
      filmThickness: p.filmThickness ?? null,
      sprayViscosity: p.sprayViscosity ?? null,
    })),
  }
}

function ProcessKitLineCard({
  line,
  isReadOnly,
  onNotesChange,
  onRemove,
}: {
  line: ProcessKitLine
  isReadOnly: boolean
  onNotesChange: (notes: string) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(isReadOnly)
  const materialsLabel = line.detail
    ? formatProcessKitMaterialsSummary(line.detail.materials, line.detail.otherNote)
    : null
  const productsLabel = line.detail ? formatProcessKitProductsSummary(line.detail.products) : null

  return (
    <div className="rounded-lg border space-y-4 p-4" style={{ borderColor: '#2A2418', background: '#0A0A08' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
              <span className="font-mono text-xs opacity-70 mr-2">{line.code}</span>
              {line.name}
            </h3>
            {line.detail && !line.loading && (
              <button
                type="button"
                onClick={() => setExpanded(prev => !prev)}
                className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 hover:bg-[#1E1C15]"
                style={{ color: '#C9A96E' }}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? '收起工艺书内容' : '展开工艺书内容'}
              </button>
            )}
          </div>
          {line.loading ? (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>加载适用材料与产品...</p>
          ) : line.detail ? (
            <div className="space-y-0.5">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                适用材料：{materialsLabel ?? '—'}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                适用产品：{productsLabel ?? '—'}
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/admin/cosmocoat-process-kits/${line.processKitId}`}
            className="text-xs underline"
            style={{ color: '#C9A96E' }}
          >
            打开工艺书
          </Link>
          {!isReadOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded hover:bg-[#1E1C15]"
              aria-label="移除工艺书"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {line.loading ? (
        <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>加载工艺流程...</p>
      ) : line.detail && expanded ? (
        <>
          {line.detail.performanceStandards.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>性能测试标准</p>
              <div className="flex flex-wrap gap-1.5">
                {line.detail.performanceStandards.map(std => (
                  <span key={std} className="px-2 py-0.5 rounded text-xs" style={{ background: '#111108', color: 'var(--foreground)' }}>
                    {getPerformanceStandardLabel(std)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {line.detail.products.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th style={th}>产品</th>
                    <th style={th}>IR 时间 (min)</th>
                    <th style={th}>IR 温度 (°C)</th>
                    <th style={th}>UV 能量 (MJ/CM²)</th>
                    <th style={th}>膜厚 (μm)</th>
                    <th style={th}>喷涂粘度 (S)</th>
                  </tr>
                </thead>
                <tbody>
                  {line.detail.products.map(product => (
                    <tr key={product.id}>
                      <td style={{ ...td, color: 'var(--foreground)' }}>{product.productName}</td>
                      <td style={td}>{displayProcessParameter(product.irMinutes, formatIrMinutes)}</td>
                      <td style={td}>{displayProcessParameter(product.irTemperature, formatIrTemperature)}</td>
                      <td style={td}>{displayProcessParameter(product.uvEnergy, formatUvEnergy)}</td>
                      <td style={td}>{displayProcessParameter(product.filmThickness, formatFilmThickness)}</td>
                      <td style={td}>{displayProcessParameter(product.sprayViscosity, formatSprayViscosity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {line.detail.processFlowDocument ? (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>完整工艺流程</p>
              <pre className="text-xs whitespace-pre-wrap rounded-lg p-3 font-sans leading-relaxed" style={{ background: '#0E0E0A', color: 'var(--foreground)' }}>
                {line.detail.processFlowDocument}
              </pre>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#5A5040' }}>该工艺书暂无工艺流程文档</p>
          )}
        </>
      ) : !line.detail ? (
        <p className="text-sm" style={{ color: '#5A5040' }}>无法加载工艺书内容</p>
      ) : null}

      <Field label="备注">
        <input
          disabled={isReadOnly}
          value={line.notes}
          onChange={e => onNotesChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded text-sm outline-none disabled:opacity-60"
          style={inputStyle()}
          placeholder="打样备注（可选）"
        />
      </Field>
    </div>
  )
}

const SAMPLE_ORDER_PRINT_AREA_ID = 'cosmocoat-sample-order-print-area'

const printCell: React.CSSProperties = { padding: '3px 6px', border: '1px solid #ccc' }
const printLabelCell: React.CSSProperties = { ...printCell, background: '#f5f5f5', fontWeight: 600 }

type SampleOrderPrintViewProps = {
  order: SampleOrderRow
  isUrgent: boolean
  sampleKind: string
  substrateType: string
  samplePanelRequirement: string
  sampleOilRequirement: string
  specialProcessRequirement: string
  areaRemark: string
  notes: string
  referenceImageUrl: string
  processKitLines: ProcessKitLine[]
  colorFormulaLines: ColorFormulaLine[]
}

function SampleOrderPrintView({
  order,
  isUrgent,
  sampleKind,
  substrateType,
  samplePanelRequirement,
  sampleOilRequirement,
  specialProcessRequirement,
  areaRemark,
  notes,
  referenceImageUrl,
  processKitLines,
  colorFormulaLines,
}: SampleOrderPrintViewProps) {
  const { customer } = order
  const formulaMaterialLines = order.colorFormulas
  const urgentTextColor = isUrgent ? '#DC2626' : '#000'

  return (
    <div id={SAMPLE_ORDER_PRINT_AREA_ID}>
      <div style={{ fontWeight: 700, fontSize: 14, textAlign: 'center', marginBottom: 10 }}>
        CosmoCoat 打样单
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 9 }}>
        <tbody>
          <tr>
            <td style={{ ...printLabelCell, width: '15%' }}>打样单号</td>
            <td style={{ ...printCell, width: '35%' }}>{order.code}</td>
            <td style={{ ...printLabelCell, width: '15%' }}>状态</td>
            <td style={{ ...printCell, width: '35%' }}>{STATUS_LABEL[order.status]}</td>
          </tr>
          <tr>
            <td style={printLabelCell}>客户编号</td>
            <td style={printCell}>{customer.code}</td>
            <td style={printLabelCell}>客户名称</td>
            <td style={printCell}>{customer.name}</td>
          </tr>
          <tr>
            <td style={printLabelCell}>特急</td>
            <td style={printCell}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 12,
                    height: 12,
                    border: '1px solid #000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    lineHeight: 1,
                    color: urgentTextColor,
                  }}
                >
                  {isUrgent ? '✓' : ''}
                </span>
                <span style={{ color: urgentTextColor, fontWeight: isUrgent ? 700 : 400 }}>特急</span>
              </span>
            </td>
            <td style={printLabelCell}>销售人员</td>
            <td style={printCell}>{formatEmployeeOption(order.salesEmployee)}</td>
          </tr>
          <tr>
            <td style={printLabelCell}>负责人员</td>
            <td style={printCell}>{formatEmployeeOption(order.technicalEmployee)}</td>
            <td style={printLabelCell}>联系电话</td>
            <td style={printCell}>{customer.phone || '—'}</td>
          </tr>
          <tr>
            <td style={printLabelCell}>地址</td>
            <td colSpan={3} style={printCell}>{customer.address || '—'}</td>
          </tr>
          {customer.productionEquipmentParams && (
            <tr>
              <td style={printLabelCell}>生产设备参数</td>
              <td colSpan={3} style={{ ...printCell, whiteSpace: 'pre-wrap' }}>{customer.productionEquipmentParams}</td>
            </tr>
          )}
          <tr>
            <td style={printLabelCell}>创建时间</td>
            <td style={printCell}>{formatDatetime(order.createdAt)}</td>
            <td style={printLabelCell}>开始时间</td>
            <td style={printCell}>{formatDatetime(order.startedAt)}</td>
          </tr>
          <tr>
            <td style={printLabelCell}>完成时间</td>
            <td style={printCell}>{formatDatetime(order.completedAt)}</td>
            <td style={printLabelCell}>调色配方总重</td>
            <td style={printCell}>{formatWeight(order.totalQuantityKg)} kg</td>
          </tr>
          {substrateType.trim() && (
            <tr>
              <td style={printLabelCell}>素材选择</td>
              <td colSpan={3} style={{ ...printCell, whiteSpace: 'pre-wrap' }}>{substrateType.trim()}</td>
            </tr>
          )}
          {sampleKind.trim() && (
            <tr>
              <td style={printLabelCell}>打样种类</td>
              <td colSpan={3} style={{ ...printCell, whiteSpace: 'pre-wrap' }}>{sampleKind.trim()}</td>
            </tr>
          )}
          {samplePanelRequirement.trim() && (
            <tr>
              <td style={printLabelCell}>样板要求</td>
              <td colSpan={3} style={{ ...printCell, whiteSpace: 'pre-wrap' }}>{samplePanelRequirement.trim()}</td>
            </tr>
          )}
          {sampleOilRequirement.trim() && (
            <tr>
              <td style={printLabelCell}>样油要求</td>
              <td colSpan={3} style={{ ...printCell, whiteSpace: 'pre-wrap' }}>{sampleOilRequirement.trim()}</td>
            </tr>
          )}
          {specialProcessRequirement.trim() && (
            <tr>
              <td style={printLabelCell}>特别工艺</td>
              <td colSpan={3} style={{ ...printCell, whiteSpace: 'pre-wrap' }}>{specialProcessRequirement.trim()}</td>
            </tr>
          )}
          {notes.trim() && (
            <tr>
              <td style={printLabelCell}>备注</td>
              <td colSpan={3} style={{ ...printCell, whiteSpace: 'pre-wrap' }}>{notes.trim()}</td>
            </tr>
          )}
          {areaRemark.trim() && (
            <tr>
              <td style={printLabelCell}>区域备注（技术人员反馈）</td>
              <td colSpan={3} style={{ ...printCell, whiteSpace: 'pre-wrap' }}>{areaRemark.trim()}</td>
            </tr>
          )}
        </tbody>
      </table>

      {referenceImageUrl && (
        <>
          <div className="print-section-title" style={{ fontWeight: 700, fontSize: 10, marginBottom: 4, borderLeft: '3px solid #000', paddingLeft: 6 }}>
            参考样品
          </div>
          <div style={{ marginBottom: 14, textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={referenceImageUrl}
              alt="参考样品"
              style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain' }}
            />
          </div>
        </>
      )}

      {processKitLines.length > 0 && (
        <>
          <div className="print-section-title" style={{ fontWeight: 700, fontSize: 10, marginBottom: 4, borderLeft: '3px solid #000', paddingLeft: 6 }}>
            工艺书明细
          </div>
          {processKitLines.map(line => (
            <div key={line.key} style={{ marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6, fontSize: 9 }}>
                <tbody>
                  <tr>
                    <td style={{ ...printLabelCell, width: '15%' }}>工艺书编号</td>
                    <td style={{ ...printCell, width: '35%' }}>{line.code}</td>
                    <td style={{ ...printLabelCell, width: '15%' }}>工艺书名称</td>
                    <td style={{ ...printCell, width: '35%' }}>{line.name}</td>
                  </tr>
                  {line.detail && formatProcessKitMaterialsSummary(line.detail.materials, line.detail.otherNote) && (
                    <tr>
                      <td style={printLabelCell}>适用材料</td>
                      <td colSpan={3} style={printCell}>
                        {formatProcessKitMaterialsSummary(line.detail.materials, line.detail.otherNote)}
                      </td>
                    </tr>
                  )}
                  {line.detail && formatProcessKitProductsSummary(line.detail.products) && (
                    <tr>
                      <td style={printLabelCell}>适用产品</td>
                      <td colSpan={3} style={printCell}>
                        {formatProcessKitProductsSummary(line.detail.products)}
                      </td>
                    </tr>
                  )}
                  {line.notes.trim() && (
                    <tr>
                      <td style={printLabelCell}>备注</td>
                      <td colSpan={3} style={{ ...printCell, whiteSpace: 'pre-wrap' }}>{line.notes.trim()}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {line.detail && line.detail.performanceStandards.length > 0 && (
                <div style={{ fontSize: 9, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>性能测试标准：</span>
                  {formatPerformanceStandardLabels(line.detail.performanceStandards).join('、')}
                </div>
              )}

              {line.detail && line.detail.products.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6, fontSize: 9 }}>
                  <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                      {['产品', 'IR 时间 (min)', 'IR 温度 (°C)', 'UV 能量 (MJ/CM²)', '膜厚 (μm)', '喷涂粘度 (S)'].map(h => (
                        <th key={h} style={{ ...printCell, fontWeight: 600, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {line.detail.products.map((product, index) => (
                      <tr key={product.id} style={{ background: index % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td style={printCell}>{product.productName}</td>
                        <td style={printCell}>{displayProcessParameter(product.irMinutes, formatIrMinutes)}</td>
                        <td style={printCell}>{displayProcessParameter(product.irTemperature, formatIrTemperature)}</td>
                        <td style={printCell}>{displayProcessParameter(product.uvEnergy, formatUvEnergy)}</td>
                        <td style={printCell}>{displayProcessParameter(product.filmThickness, formatFilmThickness)}</td>
                        <td style={printCell}>{displayProcessParameter(product.sprayViscosity, formatSprayViscosity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {line.detail?.processFlowDocument && (
                <div style={{ fontSize: 9, marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>完整工艺流程</div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.5 }}>{line.detail.processFlowDocument}</pre>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {colorFormulaLines.length > 0 && (
        <>
          <div className="print-section-title" style={{ fontWeight: 700, fontSize: 10, marginBottom: 4, borderLeft: '3px solid #000', paddingLeft: 6 }}>
            调色配方明细
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 9 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                {['调色配方', '类别', '数量 (kg)', '备注'].map(h => (
                  <th key={h} style={{ ...printCell, fontWeight: 600, textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colorFormulaLines.map((line, index) => (
                <tr key={line.key} style={{ background: index % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={printCell}>
                    <span style={{ fontFamily: 'monospace', marginRight: 4 }}>{line.code}</span>
                    {line.name}
                  </td>
                  <td style={printCell}>{line.categoryLabel || '—'}</td>
                  <td style={printCell}>{formatWeight(Number(line.quantityKg))}</td>
                  <td style={printCell}>{line.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {formulaMaterialLines.length > 0 && formulaMaterialLines.map(line => (
        <div key={line.id} style={{ marginBottom: 14 }}>
          <div className="print-section-title" style={{ fontWeight: 700, fontSize: 10, marginBottom: 4, borderLeft: '3px solid #000', paddingLeft: 6 }}>
            调色配方材料表 · {line.colorFormula.code} · {line.colorFormula.name}
          </div>
          <div style={{ fontSize: 9, marginBottom: 4 }}>
            目标色：{line.colorFormula.targetColor || '—'} · 打样数量：{formatWeight(line.quantityKg)} kg
            {line.colorFormula.factoryProduct && (
              <> · 适用产品：{line.colorFormula.factoryProduct.productCode} · {line.colorFormula.factoryProduct.name}</>
            )}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                {['序号', '生产编号', '原料/产品名称', '用量 (kg)', '占比'].map(h => (
                  <th key={h} style={{ ...printCell, fontWeight: 600, textAlign: h === '序号' ? 'center' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {line.scaledItems.map((item, index) => (
                <tr key={item.id} style={{ background: index % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={{ ...printCell, textAlign: 'center' }}>{index + 1}</td>
                  <td style={printCell}>{item.productionCode || '—'}</td>
                  <td style={printCell}>{item.name || '—'}</td>
                  <td style={printCell}>{formatWeight(item.scaledQuantity)}</td>
                  <td style={printCell}>{item.scaledPercentage != null ? formatPercent(item.scaledPercentage) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 9 }}>
        <tbody>
          <tr>
            {['打样人员', '质检确认', '客户签收'].map(label => (
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

function ProgressSteps({ status, startedAt, completedAt }: { status: SampleOrderRow['status']; startedAt: string | null; completedAt: string | null }) {
  const steps = [
    { key: 'DRAFT', label: '草稿' },
    { key: 'IN_PROGRESS', label: '进行中' },
    { key: 'COMPLETED', label: '已完成' },
  ] as const
  const activeIndex = status === 'DRAFT' ? 0 : status === 'IN_PROGRESS' ? 1 : 2

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{
                background: index <= activeIndex ? '#C9A96E' : '#1E1C15',
                color: index <= activeIndex ? '#0A0805' : '#756A58',
              }}
            >
              {index + 1}
            </div>
            <span className="text-sm" style={{ color: index <= activeIndex ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div className="flex-1 h-px mx-2" style={{ background: index < activeIndex ? '#C9A96E' : '#2A2418' }} />
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <div>开始时间：{formatDatetime(startedAt)}</div>
        <div>完成时间：{formatDatetime(completedAt)}</div>
      </div>
    </div>
  )
}

export default function AdminCosmoCoatSampleOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const isNew = orderId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [order, setOrder] = useState<SampleOrderRow | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [salesEmployeeId, setSalesEmployeeId] = useState('')
  const [technicalEmployeeId, setTechnicalEmployeeId] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [sampleKind, setSampleKind] = useState('')
  const [substrateType, setSubstrateType] = useState('')
  const [samplePanelRequirement, setSamplePanelRequirement] = useState('')
  const [sampleOilRequirement, setSampleOilRequirement] = useState('')
  const [specialProcessRequirement, setSpecialProcessRequirement] = useState('')
  const [areaRemark, setAreaRemark] = useState('')
  const [notes, setNotes] = useState('')
  const [referenceImageUrl, setReferenceImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [processKitLines, setProcessKitLines] = useState<ProcessKitLine[]>([])
  const [colorFormulaLines, setColorFormulaLines] = useState<ColorFormulaLine[]>([])

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [salesEmployees, setSalesEmployees] = useState<EmployeeOption[]>([])
  const [technicalEmployees, setTechnicalEmployees] = useState<EmployeeOption[]>([])
  const [formulaOptions, setFormulaOptions] = useState<ColorFormulaOption[]>([])
  const [formulaSearch, setFormulaSearch] = useState('')

  const isReadOnly = !isNew && order?.status === 'COMPLETED'
  const status = order?.status ?? 'DRAFT'

  function handlePrint() {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 100)
  }

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cosmocoat/sample-orders/picker/customers?limit=200')
      const data = await res.json()
      if (!res.ok) return
      setCustomers((data.customers ?? []).map((c: CustomerOption) => ({ id: c.id, code: c.code, name: c.name })))
    } catch {
      // silent
    }
  }, [])

  const fetchEmployeeOptions = useCallback(async (employeeType: 'SALES' | 'TECHNICAL') => {
    try {
      const params = new URLSearchParams({ employeeType, limit: '100' })
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/picker/employees?${params}`)
      const data = await res.json()
      if (!res.ok) return
      const employees = (data.employees ?? []) as EmployeeOption[]
      if (employeeType === 'SALES') {
        setSalesEmployees(employees)
      } else {
        setTechnicalEmployees(employees)
      }
    } catch {
      // silent
    }
  }, [])

  const fetchFormulaOptions = useCallback(async (q: string) => {
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/picker/color-formulas?${params}`)
      const data = await res.json()
      if (!res.ok) return
      setFormulaOptions((data.items ?? []).map((f: ColorFormulaOption) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        categoryLabel: f.categoryLabel,
        targetColor: f.targetColor,
        unitCost: f.unitCost ?? null,
      })))
    } catch {
      // silent
    }
  }, [])

  const fetchOrder = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/${orderId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载失败')
        return
      }
      const loaded = data.order as SampleOrderRow
      setOrder(loaded)
      setCustomerId(loaded.customer.id)
      setSalesEmployeeId(loaded.salesEmployeeId ?? '')
      setTechnicalEmployeeId(loaded.technicalEmployeeId ?? '')
      setIsUrgent(loaded.isUrgent)
      setSalesEmployees(prev => mergeEmployeeOption(prev, loaded.salesEmployee))
      setTechnicalEmployees(prev => mergeEmployeeOption(prev, loaded.technicalEmployee))
      setSampleKind(loaded.sampleKind ?? '')
      setSubstrateType(loaded.substrateType)
      setSamplePanelRequirement(loaded.samplePanelRequirement)
      setSampleOilRequirement(loaded.sampleOilRequirement)
      setSpecialProcessRequirement(loaded.specialProcessRequirement)
      setAreaRemark(loaded.areaRemark ?? '')
      setNotes(loaded.notes)
      setReferenceImageUrl(loaded.referenceImageUrl ?? '')
      setProcessKitLines(loaded.processKits.map(line => ({
        key: line.id,
        processKitId: line.processKitId,
        code: line.processKit.code,
        name: line.processKit.name,
        notes: line.notes,
        detail: extractProcessKitDetail(line.processKit),
      })))
      setColorFormulaLines(loaded.colorFormulas.map(line => ({
        key: line.id,
        colorFormulaId: line.colorFormulaId,
        code: line.colorFormula.code,
        name: line.colorFormula.name,
        categoryLabel: line.colorFormula.categoryLabel,
        unitCost: line.colorFormula.unitCost,
        quantityKg: String(line.quantityKg),
        notes: line.notes,
      })))
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [isNew, orderId])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => {
    fetchEmployeeOptions('SALES')
    fetchEmployeeOptions('TECHNICAL')
  }, [fetchEmployeeOptions])
  useEffect(() => { fetchOrder() }, [fetchOrder])
  useEffect(() => {
    const timer = setTimeout(() => fetchFormulaOptions(formulaSearch), formulaSearch ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchFormulaOptions, formulaSearch])

  const selectedKitIds = useMemo(() => new Set(processKitLines.map(l => l.processKitId)), [processKitLines])
  const selectedFormulaIds = useMemo(() => new Set(colorFormulaLines.map(l => l.colorFormulaId)), [colorFormulaLines])

  async function addProcessKit(kit: ProcessKitOption) {
    if (processKitLines.length >= 1) {
      toast.error('每个打样单只能关联一个工艺套件')
      return
    }
    if (selectedKitIds.has(kit.id)) {
      toast.error('该工艺书已添加')
      return
    }

    const key = newKey()
    setProcessKitLines(prev => [...prev, {
      key,
      processKitId: kit.id,
      code: kit.code,
      name: kit.name,
      notes: '',
      detail: null,
      loading: true,
    }])

    try {
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/picker/process-kits/${kit.id}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '加载工艺书失败')
        setProcessKitLines(prev => prev.filter(row => row.key !== key))
        return
      }
      setProcessKitLines(prev => prev.map(row => row.key === key
        ? { ...row, loading: false, detail: extractProcessKitDetail(data.kit) }
        : row))
    } catch {
      toast.error('加载工艺书失败')
      setProcessKitLines(prev => prev.filter(row => row.key !== key))
    }
  }

  function addColorFormula(formula: ColorFormulaOption) {
    if (selectedFormulaIds.has(formula.id)) {
      toast.error('该调色配方已添加')
      return
    }
    setColorFormulaLines(prev => [...prev, {
      key: newKey(),
      colorFormulaId: formula.id,
      code: formula.code,
      name: formula.name,
      categoryLabel: formula.categoryLabel,
      unitCost: formula.unitCost,
      quantityKg: '1',
      notes: '',
    }])
  }

  function buildPayload(extra?: { status?: SampleOrderRow['status'] }) {
    const processKits = processKitLines.map((line, index) => ({
      processKitId: line.processKitId,
      sortOrder: index,
      notes: line.notes,
    }))
    const colorFormulas = colorFormulaLines.map((line, index) => ({
      colorFormulaId: line.colorFormulaId,
      quantityKg: Number(line.quantityKg),
      sortOrder: processKitLines.length + index,
      notes: line.notes,
    }))
    return {
      customerId,
      salesEmployeeId: salesEmployeeId || null,
      technicalEmployeeId: technicalEmployeeId || null,
      isUrgent,
      sampleKind,
      substrateType,
      samplePanelRequirement,
      sampleOilRequirement,
      specialProcessRequirement,
      areaRemark,
      notes,
      referenceImageUrl: referenceImageUrl.trim() || null,
      processKits,
      colorFormulas,
      ...extra,
    }
  }

  async function uploadReferenceImage(file: File) {
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/cosmocoat/sample-orders/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '图片上传失败')
        return
      }
      setReferenceImageUrl(data.imageUrl)
      toast.success('参考样品图片已上传')
    } catch {
      toast.error('图片上传失败')
    } finally {
      setUploadingImage(false)
    }
  }

  async function save(extra?: { status?: SampleOrderRow['status'] }) {
    if (!customerId) {
      toast.error('请选择客户')
      return
    }
    if (processKitLines.length > 1) {
      toast.error('每个打样单只能关联一个工艺套件')
      return
    }
    if (processKitLines.length === 0 && colorFormulaLines.length === 0) {
      toast.error('请至少添加一条工艺书或调色配方')
      return
    }
    if (processKitLines.some(line => line.loading)) {
      toast.error('工艺书内容仍在加载，请稍候')
      return
    }
    for (const line of colorFormulaLines) {
      if (!line.quantityKg || Number(line.quantityKg) <= 0) {
        toast.error(`调色配方「${line.name}」数量无效`)
        return
      }
    }

    setSaving(true)
    try {
      const payload = buildPayload(extra)
      const res = isNew
        ? await fetch('/api/admin/cosmocoat/sample-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/cosmocoat/sample-orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '保存失败')
        return
      }
      toast.success(extra?.status === 'IN_PROGRESS' ? '已开始打样' : extra?.status === 'COMPLETED' ? '已标记完成' : '已保存')
      if (isNew) {
        router.replace(`/admin/cosmocoat-sample-orders/${data.order.id}`)
      } else {
        setOrder(data.order)
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(next: SampleOrderRow['status']) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cosmocoat/sample-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '状态更新失败')
        return
      }
      setOrder(data.order)
      toast.success(next === 'IN_PROGRESS' ? '已开始打样' : '已标记完成')
    } catch {
      toast.error('状态更新失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</div>
  }

  return (
    <>
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

          #${SAMPLE_ORDER_PRINT_AREA_ID} {
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

          #${SAMPLE_ORDER_PRINT_AREA_ID} * {
            box-sizing: border-box;
            max-width: 100%;
          }

          #${SAMPLE_ORDER_PRINT_AREA_ID} table {
            table-layout: fixed;
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt !important;
          }

          #${SAMPLE_ORDER_PRINT_AREA_ID} td,
          #${SAMPLE_ORDER_PRINT_AREA_ID} th {
            word-break: break-all;
            overflow-wrap: break-word;
            overflow: hidden;
            padding: 4px 6px !important;
            font-size: 10pt !important;
            line-height: 1.4;
          }

          #${SAMPLE_ORDER_PRINT_AREA_ID} .print-section-title {
            font-size: 12pt !important;
            margin-bottom: 6px !important;
          }

          #${SAMPLE_ORDER_PRINT_AREA_ID} .signature-cell {
            padding: 18px 10px 6px !important;
          }
        }

        @media screen {
          #${SAMPLE_ORDER_PRINT_AREA_ID} { display: none; }
        }
      `}</style>

      {!isNew && order && (
        <SampleOrderPrintView
          order={order}
          isUrgent={isUrgent}
          sampleKind={sampleKind}
          substrateType={substrateType}
          samplePanelRequirement={samplePanelRequirement}
          sampleOilRequirement={sampleOilRequirement}
          specialProcessRequirement={specialProcessRequirement}
          areaRemark={areaRemark}
          notes={notes}
          referenceImageUrl={referenceImageUrl}
          processKitLines={processKitLines}
          colorFormulaLines={colorFormulaLines}
        />
      )}

      <div className="cosmocoat-screen">
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cosmocoat-sample-orders" className="p-2 rounded-lg hover:bg-[#111108]">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {isNew ? '新建打样单' : order?.code ?? '打样单详情'}
            </h1>
            {!isNew && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                状态：{STATUS_LABEL[status]}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && order && (
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: '#1A1A12', border: '1px solid #2A2418', color: 'var(--foreground)' }}
            >
              <Printer size={14} /> {printing ? '准备中...' : '打印'}
            </button>
          )}
          {!isReadOnly && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              <Save size={15} /> 保存
            </button>
          )}
          {!isNew && status === 'DRAFT' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save({ status: 'IN_PROGRESS' })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: '#38bdf822', color: '#38bdf8', border: '1px solid #38bdf844' }}
            >
              <PlayCircle size={15} /> 开始打样
            </button>
          )}
          {!isNew && status === 'IN_PROGRESS' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => updateStatus('COMPLETED')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' }}
            >
              <CheckCircle2 size={15} /> 标记完成
            </button>
          )}
        </div>
      </div>

      {!isNew && order && (
        <div style={card} className="p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>进度追踪</h2>
          <ProgressSteps status={order.status} startedAt={order.startedAt} completedAt={order.completedAt} />
        </div>
      )}

      <div style={card} className="p-5 space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>基本信息</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="客户 *">
            <select
              value={customerId}
              disabled={isReadOnly}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
              style={inputStyle()}
            >
              <option value="">选择客户...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="销售人员">
            <select
              value={salesEmployeeId}
              disabled={isReadOnly}
              onChange={e => setSalesEmployeeId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
              style={inputStyle()}
            >
              <option value="">选择销售人员...</option>
              {salesEmployees.map(employee => (
                <option key={employee.id} value={employee.id}>{formatEmployeeOption(employee)}</option>
              ))}
            </select>
          </Field>
          <Field label="负责人员">
            <select
              value={technicalEmployeeId}
              disabled={isReadOnly}
              onChange={e => setTechnicalEmployeeId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
              style={inputStyle()}
            >
              <option value="">选择负责人员...</option>
              {technicalEmployees.map(employee => (
                <option key={employee.id} value={employee.id}>{formatEmployeeOption(employee)}</option>
              ))}
            </select>
          </Field>
        </div>
        <label
          className="inline-flex items-center gap-2 text-sm select-none"
          style={{ color: 'var(--foreground)' }}
        >
          <input
            type="checkbox"
            checked={isUrgent}
            disabled={isReadOnly}
            onChange={e => setIsUrgent(e.target.checked)}
            className="h-4 w-4 rounded border disabled:opacity-60"
            style={{ accentColor: '#DC2626' }}
          />
          <span style={{ color: isUrgent ? '#DC2626' : 'var(--foreground)', fontWeight: isUrgent ? 700 : 500 }}>
            特急
          </span>
        </label>
        <Field label="参考样品图片">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="rounded-lg border flex items-center justify-center overflow-hidden shrink-0 w-full max-w-lg min-h-[240px]"
              style={{ borderColor: '#2A2418', background: '#0E0E0A' }}
            >
              {referenceImageUrl ? (
                <img
                  src={referenceImageUrl}
                  alt="参考样品"
                  className="w-full object-contain p-2 max-h-[480px]"
                />
              ) : (
                <ImagePlus size={28} style={{ color: '#5A5040' }} />
              )}
            </div>
            <div className="space-y-2 flex-1 min-w-[200px]">
              {!isReadOnly && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) void uploadReferenceImage(file)
                      e.target.value = ''
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
                      style={{ background: '#111108', border: '1px solid #2A2418', color: 'var(--foreground)' }}
                    >
                      {uploadingImage ? '上传中...' : '上传图片'}
                    </button>
                    {referenceImageUrl && (
                      <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => setReferenceImageUrl('')}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ background: '#1E1C15', color: 'var(--muted-foreground)' }}
                      >
                        移除
                      </button>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    限 1 张，支持 JPG / PNG / WEBP，最大 8MB，上传至 OSS
                  </p>
                </>
              )}
              {isReadOnly && !referenceImageUrl && (
                <p className="text-sm" style={{ color: '#5A5040' }}>未上传参考样品图片</p>
              )}
            </div>
          </div>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="素材选择">
            <input
              list="sample-order-substrate-options"
              value={substrateType}
              disabled={isReadOnly}
              onChange={e => setSubstrateType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
              style={inputStyle()}
              placeholder="选择或输入自定义素材"
              autoComplete="off"
            />
            <datalist id="sample-order-substrate-options">
              {SUBSTRATE_OPTIONS.map(material => (
                <option key={material} value={material} />
              ))}
            </datalist>
          </Field>
          <Field label="打样种类">
            <select
              value={sampleKind}
              disabled={isReadOnly}
              onChange={e => setSampleKind(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
              style={inputStyle()}
            >
              <option value="">请选择打样种类...</option>
              {SAMPLE_KIND_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="样板要求">
          <input
            value={samplePanelRequirement}
            disabled={isReadOnly}
            onChange={e => setSamplePanelRequirement(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
            style={inputStyle()}
            placeholder="例如：多少干板、干板规格等"
          />
        </Field>
        <Field label="样油要求">
          <input
            value={sampleOilRequirement}
            disabled={isReadOnly}
            onChange={e => setSampleOilRequirement(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
            style={inputStyle()}
            placeholder="记录样油相关要求"
          />
        </Field>
        <Field label="特别工艺(常规不能满足)">
          <input
            value={specialProcessRequirement}
            disabled={isReadOnly}
            onChange={e => setSpecialProcessRequirement(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
            style={inputStyle()}
            placeholder="记录超出标准工艺的定制制作要求"
          />
        </Field>
        <Field label="备注">
          <textarea
            value={notes}
            disabled={isReadOnly}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y disabled:opacity-60"
            style={inputStyle()}
            placeholder="打样要求、交付说明等"
          />
        </Field>
        <Field label="区域备注（技术人员反馈）">
          <textarea
            value={areaRemark}
            disabled={isReadOnly}
            onChange={e => setAreaRemark(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y disabled:opacity-60"
            style={inputStyle()}
            placeholder="记录技术人员反馈的区域相关打样细节、注意事项或特殊说明"
          />
        </Field>
      </div>

      <div style={card} className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>工艺书明细</h2>
          {!isReadOnly && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>每个打样单仅可关联一个工艺套件；添加后在标题区显示适用材料与适用产品，可展开查看完整工艺流程</span>}
        </div>

        {!isReadOnly && processKitLines.length === 0 && (
          <div className="space-y-2">
            <ProcessKitCombobox
              onSelect={addProcessKit}
              selectedIds={[...selectedKitIds]}
              inputStyle={inputStyle()}
            />
          </div>
        )}

        {processKitLines.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: '#5A5040' }}>尚未添加工艺书</p>
        ) : (
          <div className="space-y-3">
            {processKitLines.map(line => (
              <ProcessKitLineCard
                key={line.key}
                line={line}
                isReadOnly={isReadOnly}
                onNotesChange={notes => setProcessKitLines(prev => prev.map(row => row.key === line.key ? { ...row, notes } : row))}
                onRemove={() => setProcessKitLines(prev => prev.filter(row => row.key !== line.key))}
              />
            ))}
          </div>
        )}
      </div>

      <div style={card} className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>调色配方明细</h2>
          {!isReadOnly && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>从现有调色配方中选择并填写打样数量（kg）</span>}
        </div>

        {!isReadOnly && (
          <div className="space-y-2">
            <div className="relative max-w-md">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                value={formulaSearch}
                onChange={e => setFormulaSearch(e.target.value)}
                placeholder="搜索调色配方编号或名称..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle()}
              />
            </div>
            {formulaOptions.length > 0 && (
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#2A2418' }}>
                {formulaOptions.filter(f => !selectedFormulaIds.has(f.id)).slice(0, 8).map(formula => (
                  <button
                    key={formula.id}
                    type="button"
                    onClick={() => addColorFormula(formula)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#111108] border-b last:border-b-0"
                    style={{ borderColor: '#1E1C15', color: 'var(--foreground)' }}
                  >
                    <span>
                      <span className="font-mono text-xs opacity-70 mr-2">{formula.code}</span>
                      {formula.name}
                      {formula.targetColor && <span className="text-xs ml-2 opacity-60">· {formula.targetColor}</span>}
                    </span>
                    <Plus size={14} style={{ color: '#C9A96E' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {colorFormulaLines.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: '#5A5040' }}>尚未添加调色配方</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th style={th}>调色配方</th>
                  <th style={th}>类别</th>
                  <th style={{ ...th, textAlign: 'right' }}>总成本</th>
                  <th style={th}>备注</th>
                  {!isReadOnly && <th style={{ ...th, width: 48 }} />}
                </tr>
              </thead>
              <tbody>
                {colorFormulaLines.map(line => (
                  <tr key={line.key}>
                    <td style={{ ...td, color: 'var(--foreground)' }}>
                      <span className="font-mono text-xs mr-2 opacity-70">{line.code}</span>
                      {line.name}
                      {!isReadOnly && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <span>打样数量</span>
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={line.quantityKg}
                            onChange={e => setColorFormulaLines(prev => prev.map(row => row.key === line.key ? { ...row, quantityKg: e.target.value } : row))}
                            className="w-24 px-2 py-1 rounded text-sm outline-none"
                            style={inputStyle()}
                          />
                          <span>kg</span>
                        </div>
                      )}
                    </td>
                    <td style={td}>{line.categoryLabel || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#C9A96E', fontVariantNumeric: 'tabular-nums' }}>
                      {formatFormulaLineTotalCost(line)}
                    </td>
                    <td style={td}>
                      <input
                        disabled={isReadOnly}
                        value={line.notes}
                        onChange={e => setColorFormulaLines(prev => prev.map(row => row.key === line.key ? { ...row, notes: e.target.value } : row))}
                        className="w-full min-w-[160px] px-2 py-1 rounded text-sm outline-none disabled:opacity-60"
                        style={inputStyle()}
                      />
                    </td>
                    {!isReadOnly && (
                      <td style={td}>
                        <button
                          type="button"
                          onClick={() => setColorFormulaLines(prev => prev.filter(row => row.key !== line.key))}
                          className="p-1 rounded hover:bg-[#1E1C15]"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isNew && order && order.colorFormulas.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>调色配方内容</h2>

          {order.colorFormulas.map(line => (
            <div key={line.id} style={card} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium" style={{ color: 'var(--foreground)' }}>
                    调色配方 · {line.colorFormula.code} · {line.colorFormula.name}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    目标色：{line.colorFormula.targetColor || '—'} · 打样数量：{formatWeight(line.quantityKg)} kg
                    {line.colorFormula.factoryProduct && (
                      <> · 适用产品：{line.colorFormula.factoryProduct.productCode} · {line.colorFormula.factoryProduct.name}</>
                    )}
                  </p>
                </div>
                <Link
                  href={`/admin/cosmocoat-color-formulas/${line.colorFormulaId}`}
                  className="text-xs underline"
                  style={{ color: '#C9A96E' }}
                >
                  打开调色配方
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th style={th}>序号</th>
                      <th style={th}>生产编号</th>
                      <th style={th}>原料/产品名称</th>
                      <th style={th}>用量 (kg)</th>
                      <th style={th}>占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {line.scaledItems.map((item, index) => (
                      <tr key={item.id}>
                        <td style={td}>{index + 1}</td>
                        <td style={td}>{item.productionCode || '—'}</td>
                        <td style={{ ...td, color: 'var(--foreground)' }}>{item.name || '—'}</td>
                        <td style={td}>{formatWeight(item.scaledQuantity)}</td>
                        <td style={td}>{item.scaledPercentage != null ? formatPercent(item.scaledPercentage) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
      </div>
    </>
  )
}
