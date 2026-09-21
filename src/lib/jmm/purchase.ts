import { Prisma } from '@prisma/client'
import { decimalToNumber } from '@/lib/jmm/orders'

export const JMM_SUPPLIER_INVOICE_STATUSES = ['EXPECTED', 'RECEIVED', 'CHECKED', 'PAID'] as const

export const JMM_SHIPMENT_DOC_KINDS = [
  'BILL_OF_LADING',
  'AIRWAY_BILL',
  'PACKING_LIST',
  'SUPPLIER_INVOICE',
  'CERTIFICATE_OF_ORIGIN',
  'INSURANCE',
  'INSPECTION',
  'OTHER',
] as const

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 15 * 1024 * 1024

export async function readJmmUpload(file: File): Promise<{ buffer: Buffer; contentType: string; fileName: string; extension: string }> {
  if (file.size <= 0) throw new Error('Choose a file')
  if (file.size > MAX_BYTES) throw new Error('File is larger than 15 MB')
  const contentType = file.type || 'application/octet-stream'
  if (!ALLOWED_TYPES.has(contentType)) throw new Error('Upload a PDF, JPG, PNG, or WebP')
  const extension = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1] ?? 'bin'
  const fileName = file.name.replace(/[^\w.\- ()]/g, '_').slice(0, 180) || `file.${extension}`
  return { buffer: Buffer.from(await file.arrayBuffer()), contentType, fileName, extension }
}

export function shipmentHasTransportDoc(kinds: string[]): boolean {
  return kinds.some(kind => kind === 'BILL_OF_LADING' || kind === 'AIRWAY_BILL')
}

export function serializeSupplierInvoice(invoice: {
  id: string
  invoiceNumber: string
  invoiceDate: Date
  currency: string
  amount: Prisma.Decimal
  status: string
  notes: string
  fileName: string
  storageKey: string
  supplier: { id: string; name: string; company: string }
  shipments: {
    id: string
    reference: string
    shipper: string
    consignee: string
    carrier: string
    incoterm: string
    portOfLoading: string
    portOfDischarge: string
    etd: Date | null
    eta: Date | null
    notes: string
    files: { id: string; kind: string; fileName: string }[]
  }[]
}) {
  const shipments = invoice.shipments.map(shipment => {
    const kinds = shipment.files.map(file => file.kind)
    return {
      id: shipment.id,
      reference: shipment.reference,
      shipper: shipment.shipper,
      consignee: shipment.consignee,
      carrier: shipment.carrier,
      incoterm: shipment.incoterm,
      portOfLoading: shipment.portOfLoading,
      portOfDischarge: shipment.portOfDischarge,
      etd: shipment.etd ? shipment.etd.toISOString().slice(0, 10) : '',
      eta: shipment.eta ? shipment.eta.toISOString().slice(0, 10) : '',
      notes: shipment.notes,
      hasTransportDoc: shipmentHasTransportDoc(kinds),
      hasPackingList: kinds.includes('PACKING_LIST'),
      files: shipment.files,
    }
  })
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    currency: invoice.currency,
    amount: decimalToNumber(invoice.amount),
    status: invoice.status,
    notes: invoice.notes,
    fileName: invoice.fileName,
    hasFile: Boolean(invoice.storageKey),
    supplier: invoice.supplier,
    shipments,
    papersComplete: Boolean(invoice.storageKey) && shipments.some(shipment => shipment.hasTransportDoc && shipment.hasPackingList),
  }
}
