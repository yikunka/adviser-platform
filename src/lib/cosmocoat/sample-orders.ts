import type { CosEmployeeType, CosSampleOrderStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { customerInclude, serializeCustomer } from '@/lib/cosmocoat/customers'
import { kitInclude, serializeProcessKit } from '@/lib/cosmocoat/process-kits'
import { serializeColorFormula } from '@/lib/cosmocoat/color-formulas'

const colorFormulaDetailInclude = {
  subcategory: { select: { id: true, parentCategory: true, code: true, name: true } },
  factoryProduct: {
    select: {
      id: true,
      productCode: true,
      name: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  },
  sourceRecipe: { select: { id: true, code: true, name: true } },
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      rawMaterial: {
        select: {
          id: true,
          productionCode: true,
          name: true,
          attributeCode: true,
          category: true,
          primaryPackageKg: true,
          primaryPricePerKg: true,
          primaryNotes: true,
        },
      },
      productSemifinished: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          unitPrice: true,
        },
      },
    },
  },
} as const

const sampleOrderEmployeeSelect = {
  id: true,
  code: true,
  name: true,
  employeeType: true,
  position: true,
  department: true,
  phone: true,
  email: true,
  isActive: true,
} as const

export const sampleOrderListInclude = {
  customer: { select: { id: true, code: true, name: true, phone: true } },
  salesEmployee: { select: sampleOrderEmployeeSelect },
  technicalEmployee: { select: sampleOrderEmployeeSelect },
  processKits: { select: { quantityKg: true } },
  colorFormulas: { select: { quantityKg: true } },
} satisfies Prisma.CosSampleOrderInclude

export const sampleOrderDetailInclude = {
  customer: { include: customerInclude },
  salesEmployee: { select: sampleOrderEmployeeSelect },
  technicalEmployee: { select: sampleOrderEmployeeSelect },
  createdBy: { select: { id: true, nameEn: true, email: true } },
  processKits: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      processKit: { include: kitInclude },
    },
  },
  colorFormulas: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      colorFormula: { include: colorFormulaDetailInclude },
    },
  },
} satisfies Prisma.CosSampleOrderInclude

type SampleOrderListRow = Prisma.CosSampleOrderGetPayload<{ include: typeof sampleOrderListInclude }> & {
  isUrgent: boolean
}
type SampleOrderDetailRow = Prisma.CosSampleOrderGetPayload<{ include: typeof sampleOrderDetailInclude }> & {
  isUrgent: boolean
}
type SampleOrderEmployee = NonNullable<SampleOrderDetailRow['salesEmployee']>

function totalQuantityKg(colorFormulas: Array<{ quantityKg: unknown }>) {
  return colorFormulas.reduce((sum, row) => sum + Number(row.quantityKg), 0)
}

function serializeProcessKitLine(row: SampleOrderDetailRow['processKits'][number]) {
  const kit = serializeProcessKit(row.processKit)
  return {
    id: row.id,
    processKitId: row.processKitId,
    quantityKg: Number(row.quantityKg),
    sortOrder: row.sortOrder,
    notes: row.notes,
    processKit: kit,
  }
}

function serializeColorFormulaLine(row: SampleOrderDetailRow['colorFormulas'][number]) {
  const formula = serializeColorFormula(row.colorFormula)
  const scale = formula.batchQuantity > 0 ? Number(row.quantityKg) / formula.batchQuantity : 1
  const scaledItems = formula.items.map(item => ({
    ...item,
    scaledQuantity: item.quantity * scale,
    scaledPercentage: item.percentage != null ? item.percentage : null,
  }))

  return {
    id: row.id,
    colorFormulaId: row.colorFormulaId,
    quantityKg: Number(row.quantityKg),
    sortOrder: row.sortOrder,
    notes: row.notes,
    colorFormula: formula,
    scaledItems,
  }
}

function serializeSampleOrderEmployee(employee: SampleOrderEmployee | null) {
  return employee
    ? {
        id: employee.id,
        code: employee.code,
        name: employee.name,
        employeeType: employee.employeeType,
        position: employee.position,
        department: employee.department,
        phone: employee.phone,
        email: employee.email,
        isActive: employee.isActive,
      }
    : null
}

export function serializeSampleOrderListRow(order: SampleOrderListRow) {
  return {
    id: order.id,
    code: order.code,
    isUrgent: order.isUrgent,
    status: order.status,
    substrateType: order.substrateType,
    samplePanelRequirement: order.samplePanelRequirement,
    sampleOilRequirement: order.sampleOilRequirement,
    specialProcessRequirement: order.specialProcessRequirement,
    notes: order.notes,
    referenceImageUrl: order.referenceImageUrl,
    startedAt: order.startedAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customer: order.customer,
    salesEmployee: serializeSampleOrderEmployee(order.salesEmployee),
    technicalEmployee: serializeSampleOrderEmployee(order.technicalEmployee),
    processKitCount: order.processKits.length,
    colorFormulaCount: order.colorFormulas.length,
    totalQuantityKg: totalQuantityKg(order.colorFormulas),
  }
}

export function serializeSampleOrder(order: SampleOrderDetailRow) {
  const processKits = order.processKits.map(serializeProcessKitLine)
  const colorFormulas = order.colorFormulas.map(serializeColorFormulaLine)

  return {
    id: order.id,
    code: order.code,
    isUrgent: order.isUrgent,
    status: order.status,
    substrateType: order.substrateType,
    samplePanelRequirement: order.samplePanelRequirement,
    sampleOilRequirement: order.sampleOilRequirement,
    specialProcessRequirement: order.specialProcessRequirement,
    notes: order.notes,
    referenceImageUrl: order.referenceImageUrl,
    startedAt: order.startedAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customer: serializeCustomer(order.customer),
    salesEmployeeId: order.salesEmployeeId,
    salesEmployee: serializeSampleOrderEmployee(order.salesEmployee),
    technicalEmployeeId: order.technicalEmployeeId,
    technicalEmployee: serializeSampleOrderEmployee(order.technicalEmployee),
    createdBy: order.createdBy
      ? { id: order.createdBy.id, name: order.createdBy.nameEn, email: order.createdBy.email }
      : null,
    processKits,
    colorFormulas,
    processKitCount: processKits.length,
    colorFormulaCount: colorFormulas.length,
    totalQuantityKg: totalQuantityKg(order.colorFormulas),
  }
}

export type SampleOrderRow = ReturnType<typeof serializeSampleOrder>

export async function getSampleOrderById(id: string) {
  const order = await prisma.cosSampleOrder.findUnique({
    where: { id },
    include: sampleOrderDetailInclude,
  })
  if (!order) return null
  return serializeSampleOrder(order)
}

export async function generateSampleOrderCode(): Promise<string> {
  const latest = await prisma.cosSampleOrder.findFirst({
    where: { code: { startsWith: 'YP' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  if (!latest?.code) return 'YP0001'

  const match = latest.code.match(/^YP(\d+)$/)
  if (match) {
    const lastNumber = parseInt(match[1], 10)
    return `YP${String(lastNumber + 1).padStart(4, '0')}`
  }

  return 'YP0001'
}

export function isValidStatusTransition(
  current: CosSampleOrderStatus,
  next: CosSampleOrderStatus,
): boolean {
  if (current === next) return true
  if (current === 'DRAFT' && next === 'IN_PROGRESS') return true
  if (current === 'IN_PROGRESS' && next === 'COMPLETED') return true
  return false
}

export async function validateProcessKitIds(ids: string[]) {
  if (ids.length === 0) return
  const unique = [...new Set(ids)]
  const found = await prisma.cosProcessKit.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  })
  if (found.length !== unique.length) throw new Error('PROCESS_KIT_NOT_FOUND')
}

export async function validateColorFormulaIds(ids: string[]) {
  if (ids.length === 0) return
  const unique = [...new Set(ids)]
  const found = await prisma.cosTableColorFormula.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  })
  if (found.length !== unique.length) throw new Error('COLOR_FORMULA_NOT_FOUND')
}

export async function validateCustomerId(customerId: string) {
  const customer = await prisma.cosCustomer.findUnique({
    where: { id: customerId },
    select: { id: true },
  })
  if (!customer) throw new Error('CUSTOMER_NOT_FOUND')
}

export async function validateSampleOrderEmployeeId(
  employeeId: string | null | undefined,
  employeeType: CosEmployeeType,
) {
  if (!employeeId) return null

  const employee = await prisma.cosEmployee.findFirst({
    where: { id: employeeId, employeeType },
    select: { id: true },
  })

  if (!employee) {
    throw new Error(employeeType === 'SALES' ? 'SALES_EMPLOYEE_NOT_FOUND' : 'TECHNICAL_EMPLOYEE_NOT_FOUND')
  }

  return employee.id
}

export type SampleOrderLineInput = {
  processKitId?: string
  colorFormulaId?: string
  quantityKg?: number
  sortOrder?: number
  notes?: string
}

export function buildLineCreates(lines: SampleOrderLineInput[]) {
  const processKitCreates: Prisma.CosSampleOrderProcessKitUncheckedCreateWithoutSampleOrderInput[] = []
  const colorFormulaCreates: Prisma.CosSampleOrderColorFormulaUncheckedCreateWithoutSampleOrderInput[] = []

  lines.forEach((line, index) => {
    const sortOrder = line.sortOrder ?? index
    if (line.processKitId) {
      processKitCreates.push({
        processKitId: line.processKitId,
        quantityKg: line.quantityKg ?? 1,
        sortOrder,
        notes: line.notes?.trim() ?? '',
      })
    } else if (line.colorFormulaId != null && line.quantityKg != null) {
      colorFormulaCreates.push({
        colorFormulaId: line.colorFormulaId,
        quantityKg: line.quantityKg,
        sortOrder,
        notes: line.notes?.trim() ?? '',
      })
    }
  })

  return { processKitCreates, colorFormulaCreates }
}
