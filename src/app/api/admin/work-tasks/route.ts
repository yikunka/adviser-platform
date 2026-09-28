import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { createShareTransferTask } from '@/lib/work-tasks/create-share-transfer'
import { createShareAllotmentTask } from '@/lib/work-tasks/create-share-allotment'
import { createCompanyNameChangeTask } from '@/lib/work-tasks/create-company-name-change'
import {
  createAccountingReferenceTask,
  createRegisteredOfficeTask,
  createRegisterLocationTask,
} from '@/lib/work-tasks/create-company-record-change'
import {
  REGISTER_ITEMS,
  type AccountingReferenceInput,
  type RegisterLocationInput,
} from '@/lib/work-tasks/company-record-change'
import { SHARE_TRANSFER_DOCUMENT_KEYS, SHARE_TRANSFER_DOCUMENTS } from '@/lib/work-tasks/share-transfer-docs'
import type { ShareTransferInput } from '@/lib/work-tasks/share-transfer'
import type { ShareAllotmentInput } from '@/lib/work-tasks/share-allotment'

const nameChangeSchema = z.object({
  kind: z.literal('COMPANY_NAME_CHANGE'),
  companyId: z.string().cuid(),
  companyNameEn: z.string().trim().min(1).max(300),
  companyNameZh: z.string().trim().max(300).default(''),
  companyNo: z.string().trim().max(40).default(''),
  brn: z.string().trim().max(40).default(''),
  newCompanyNameEn: z.string().trim().max(300).default(''),
  newCompanyNameZh: z.string().trim().max(300).default(''),
  changeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shareholderNames: z.array(z.string().trim().max(300)).max(4).default([]),
  signatoryName: z.string().trim().min(1).max(200),
  signatoryCapacity: z.enum(['DIRECTOR', 'COMPANY_SECRETARY']),
  signatoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  presentorNameZh: z.string().trim().max(200).default(''),
  presentorNameEn: z.string().trim().max(200).default(''),
  presentorAddress: z.string().trim().max(500).default(''),
  presentorTel: z.string().trim().max(40).default(''),
  presentorFax: z.string().trim().max(40).default(''),
  presentorEmail: z.string().trim().max(200).default(''),
  presentorReference: z.string().trim().max(80).default(''),
})

const presentorSchema = {
  presentorNameZh: z.string().trim().max(200).default(''),
  presentorNameEn: z.string().trim().max(200).default(''),
  presentorAddress: z.string().trim().max(500).default(''),
  presentorTel: z.string().trim().max(40).default(''),
  presentorFax: z.string().trim().max(40).default(''),
  presentorEmail: z.string().trim().max(200).default(''),
  presentorReference: z.string().trim().max(80).default(''),
}

const addressLines = {
  flat: z.string().trim().max(120).default(''),
  building: z.string().trim().max(120).default(''),
  street: z.string().trim().max(200).default(''),
  district: z.string().trim().max(80).default(''),
}

const registeredOfficeSchema = z.object({
  kind: z.literal('REGISTERED_OFFICE_ADDRESS'),
  companyId: z.string().cuid(),
  companyNameEn: z.string().trim().min(1).max(300),
  companyNameZh: z.string().trim().max(300).default(''),
  companyNo: z.string().trim().max(40).default(''),
  brn: z.string().trim().max(40).default(''),
  ...addressLines,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newEmail: z.string().trim().max(200).default(''),
  newPhone: z.string().trim().max(40).default(''),
  signatoryName: z.string().trim().min(1).max(200),
  signatoryCapacity: z.enum(['DIRECTOR', 'COMPANY_SECRETARY']),
  signatoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ...presentorSchema,
})

const registerLocationSchema = z.object({
  kind: z.literal('REGISTER_LOCATION'),
  companyId: z.string().cuid(),
  companyNameEn: z.string().trim().min(1).max(300),
  companyNameZh: z.string().trim().max(300).default(''),
  companyNo: z.string().trim().max(40).default(''),
  brn: z.string().trim().max(40).default(''),
  registers: z.array(z.enum(REGISTER_ITEMS.map(item => item.key) as [string, ...string[]])).min(1),
  location: z.enum(['OTHER', 'REGISTERED_OFFICE']),
  ...addressLines,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks: z.string().trim().max(500).default(''),
  signatoryName: z.string().trim().min(1).max(200),
  signatoryCapacity: z.enum(['DIRECTOR', 'COMPANY_SECRETARY', 'MANAGER', 'AUTHORIZED_REPRESENTATIVE']),
  signatoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ...presentorSchema,
})

const accountingReferenceSchema = z.object({
  kind: z.literal('ACCOUNTING_REFERENCE_DATE'),
  companyId: z.string().cuid(),
  companyNameEn: z.string().trim().min(1).max(300),
  companyNameZh: z.string().trim().max(300).default(''),
  companyNo: z.string().trim().max(40).default(''),
  brn: z.string().trim().max(40).default(''),
  currentPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  change: z.enum(['SHORTEN', 'EXTEND']),
  newPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  extensionReason: z.enum(['NONE_IN_FIVE_YEARS', 'HOLDING_COMPANY', 'MEMBERS_RESOLUTION', '']).default(''),
  resolutionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memberNames: z.array(z.string().trim().max(300)).max(4).default([]),
  signatoryName: z.string().trim().min(1).max(200),
  signatoryCapacity: z.enum(['DIRECTOR', 'COMPANY_SECRETARY']),
  signatoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ...presentorSchema,
})

const RECORD_KINDS = ['REGISTERED_OFFICE_ADDRESS', 'REGISTER_LOCATION', 'ACCOUNTING_REFERENCE_DATE'] as const

function isRealIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

const partySchema = z.object({
  name: z.string().trim().min(1).max(300),
  address: z.string().trim().max(500).default(''),
  occupation: z.string().trim().max(200).default(''),
  keyPersonId: z.string().cuid().nullable().optional(),
  companyId: z.string().cuid().nullable().optional(),
  memberId: z.string().cuid().nullable().optional(),
})

const createSchema = z.object({
  companyId: z.string().cuid(),
  companyNameEn: z.string().trim().min(1).max(300),
  companyNameZh: z.string().trim().max(300).default(''),
  brNo: z.string().trim().max(40).default(''),
  companyNo: z.string().trim().max(40).default(''),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transferor: partySchema,
  transferee: partySchema,
  numberOfShares: z.number().int().positive().max(999_999_999),
  shareClass: z.string().trim().min(1).max(40),
  parValue: z.string().trim().min(1).max(40),
  consideration: z.string().trim().min(1).max(40),
  shareNumbers: z.string().trim().max(200).default(''),
  oldCertNo: z.string().trim().max(40).default(''),
  newCertNo: z.string().trim().max(40).default(''),
  directorName: z.string().trim().min(1).max(200),
  paidStatus: z.enum(['Fully paid', 'Partly paid']),
  paidAmount: z.string().trim().max(40).default(''),
  useCommonSeal: z.boolean(),
  documents: z.array(z.enum(SHARE_TRANSFER_DOCUMENT_KEYS)).min(1),
})

const allotmentSchema = z.object({
  kind: z.literal('SHARE_ALLOTMENT'),
  companyId: z.string().cuid(),
  companyNameEn: z.string().trim().min(1).max(300),
  companyNameZh: z.string().trim().max(300).default(''),
  companyNo: z.string().trim().max(40).default(''),
  brn: z.string().trim().max(40).default(''),
  allotmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  allotteeName: z.string().trim().min(1).max(300),
  allotteeNameZh: z.string().trim().max(300).default(''),
  allotteeAddress: z.string().trim().max(500).default(''),
  numberOfShares: z.number().int().positive().max(999_999_999),
  shareClass: z.string().trim().min(1).max(40),
  currency: z.string().trim().min(1).max(10).default('HKD'),
  amountPaidPerShare: z.string().trim().min(1).max(40),
  amountUnpaidPerShare: z.string().trim().max(40).default('0'),
  consideration: z.string().trim().min(1).max(40),
  paidStatus: z.enum(['Fully paid', 'Partly paid']),
  certNo: z.string().trim().max(40).default(''),
  directorName1: z.string().trim().min(1).max(200),
  directorName2: z.string().trim().max(200).default(''),
  meetingTime: z.string().trim().max(80).default(''),
  meetingPlace: z.string().trim().max(300).default(''),
  companySecretary: z.string().trim().max(200).default('6AM Advisory Limited'),
  useCommonSeal: z.boolean().default(false),
  capitalIncreaseAmount: z.string().trim().max(40).default(''),
  issuedTotalNumber: z.string().trim().max(40).default(''),
  issuedTotalAmount: z.string().trim().max(40).default(''),
  issuedPaidUp: z.string().trim().max(40).default(''),
  issuedUnpaid: z.string().trim().max(40).default('0'),
  signatoryName: z.string().trim().min(1).max(200),
  signatoryCapacity: z.enum(['DIRECTOR', 'COMPANY_SECRETARY']),
  signatoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ...presentorSchema,
})

function nameChangeSummary(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  return {
    changeDate: typeof record.changeDate === 'string' ? record.changeDate : '',
    newCompanyNameEn: typeof record.newCompanyNameEn === 'string' ? record.newCompanyNameEn : '',
    newCompanyNameZh: typeof record.newCompanyNameZh === 'string' ? record.newCompanyNameZh : '',
  }
}

function recordSummary(kind: string, payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const text = (key: string) => typeof record[key] === 'string' ? record[key] : ''
  const address = [text('flat'), text('building'), text('street'), text('district')].filter(Boolean).join('，')
  if (kind === 'REGISTER_LOCATION') {
    return {
      summary: text('location') === 'REGISTERED_OFFICE' ? '改为备存于注册办事处' : address,
      effectiveDate: text('effectiveDate'),
    }
  }
  if (kind === 'ACCOUNTING_REFERENCE_DATE') {
    return {
      summary: text('change') === 'SHORTEN' ? `缩短至 ${text('newPeriodEnd')}` : `延长至 ${text('newPeriodEnd')}`,
      effectiveDate: text('newPeriodEnd'),
    }
  }
  return { summary: address, effectiveDate: text('effectiveDate') }
}

function taskSummary(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const partyName = (value: unknown) => {
    if (!value || typeof value !== 'object') return ''
    const name = (value as { name?: unknown }).name
    return typeof name === 'string' ? name : ''
  }
  return {
    transferDate: typeof record.transferDate === 'string' ? record.transferDate : '',
    transferorName: partyName(record.transferor),
    transfereeName: partyName(record.transferee),
    numberOfShares: typeof record.numberOfShares === 'number' ? record.numberOfShares : null,
  }
}

function allotmentSummary(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  return {
    allotmentDate: typeof record.allotmentDate === 'string' ? record.allotmentDate : '',
    allotteeName: typeof record.allotteeName === 'string' ? record.allotteeName : '',
    numberOfShares: typeof record.numberOfShares === 'number' ? record.numberOfShares : null,
    shareClass: typeof record.shareClass === 'string' ? record.shareClass : '',
  }
}

async function loadWorkTaskCompany(userId: string, role: Parameters<typeof resolveCompanyAccess>[1], companyId: string) {
  const access = await resolveCompanyAccess(userId, role)
  if (!(await assertCompanyAccessible(access, companyId))) return null
  return prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true },
  })
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'workTasks' })
  if (error) return error

  const kind = req.nextUrl.searchParams.get('kind')
  const recordList = kind === 'COMPANY_RECORD'
  const listKind =
    recordList
      ? null
      : kind === 'COMPANY_NAME_CHANGE'
        ? 'COMPANY_NAME_CHANGE'
        : kind === 'SHARE_ALLOTMENT'
          ? 'SHARE_ALLOTMENT'
          : 'SHARE_TRANSFER'
  const tasks = await prisma.advWorkTask.findMany({
    where: {
      kind: recordList ? { in: [...RECORD_KINDS] } : listKind!,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      taskNumber: true,
      kind: true,
      createdAt: true,
      payload: true,
      company: { select: { id: true, nameEn: true, nameZh: true } },
      _count: { select: { files: true } },
    },
  })

  return NextResponse.json({
    tasks: tasks.map(task => ({
      id: task.id,
      taskNumber: task.taskNumber,
      kind: task.kind,
      createdAt: task.createdAt,
      company: task.company,
      fileCount: task._count.files,
      ...(recordList
        ? recordSummary(task.kind, task.payload)
        : listKind === 'COMPANY_NAME_CHANGE'
          ? nameChangeSummary(task.payload)
          : listKind === 'SHARE_ALLOTMENT'
            ? allotmentSummary(task.payload)
            : taskSummary(task.payload)),
    })),
  })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission('workTasks.create')
  if (error) return error

  const body = await req.json().catch(() => null)
  const requestedKind = body && typeof body === 'object' ? (body as { kind?: string }).kind : undefined
  if (requestedKind && (RECORD_KINDS as readonly string[]).includes(requestedKind)) {
    const dates = (values: string[]) => values.every(isRealIsoDate)
    if (requestedKind === 'REGISTERED_OFFICE_ADDRESS') {
      const parsed = registeredOfficeSchema.safeParse(body)
      const address = parsed.success ? [parsed.data.flat, parsed.data.building, parsed.data.street, parsed.data.district].some(Boolean) : false
      if (!parsed.success || !address || !dates([parsed.data.effectiveDate, parsed.data.signatoryDate])) {
        return NextResponse.json({ error: '请填完整注册或营业地址，以及生效日期和签署人。' }, { status: 400 })
      }
      const company = await loadWorkTaskCompany(session!.user.id, session!.user.role, parsed.data.companyId)
      if (!company) return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })
      try {
        const task = await createRegisteredOfficeTask(parsed.data.companyId, parsed.data, session!.user.id)
        return NextResponse.json({ id: task.id, taskNumber: task.taskNumber })
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '生成文件失败。'
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }
    if (requestedKind === 'REGISTER_LOCATION') {
      const parsed = registerLocationSchema.safeParse(body)
      const addressOk = parsed.success && (parsed.data.location === 'REGISTERED_OFFICE' || [parsed.data.flat, parsed.data.building, parsed.data.street, parsed.data.district].some(Boolean))
      if (!parsed.success || !addressOk || !dates([parsed.data.effectiveDate, parsed.data.signatoryDate])) {
        return NextResponse.json({ error: '请选择登记册、备存地点、生效日期和签署人。' }, { status: 400 })
      }
      const company = await loadWorkTaskCompany(session!.user.id, session!.user.role, parsed.data.companyId)
      if (!company) return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })
      try {
        const task = await createRegisterLocationTask(parsed.data.companyId, parsed.data as RegisterLocationInput, session!.user.id)
        return NextResponse.json({ id: task.id, taskNumber: task.taskNumber })
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '生成文件失败。'
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }
    const parsed = accountingReferenceSchema.safeParse(body)
    const members = parsed.success ? parsed.data.memberNames.filter(Boolean) : []
    const extensionOk = parsed.success && (parsed.data.change === 'SHORTEN' || parsed.data.extensionReason !== '')
    if (!parsed.success || members.length === 0 || !extensionOk || parsed.data.currentPeriodEnd === parsed.data.newPeriodEnd || !dates([parsed.data.currentPeriodEnd, parsed.data.newPeriodEnd, parsed.data.resolutionDate, parsed.data.signatoryDate])) {
      return NextResponse.json({ error: '请填完整会计参照日，并填写至少一名成员。延长会计期时要选择原因。' }, { status: 400 })
    }
    const company = await loadWorkTaskCompany(session!.user.id, session!.user.role, parsed.data.companyId)
    if (!company) return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })
    try {
      const task = await createAccountingReferenceTask(parsed.data.companyId, {
        ...parsed.data,
        extensionReason: parsed.data.change === 'EXTEND' ? parsed.data.extensionReason : '',
        memberNames: members,
      } as AccountingReferenceInput, session!.user.id)
      return NextResponse.json({ id: task.id, taskNumber: task.taskNumber })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '生成文件失败。'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
  if (body && typeof body === 'object' && (body as { kind?: string }).kind === 'SHARE_ALLOTMENT') {
    const parsed = allotmentSchema.safeParse(body)
    if (
      !parsed.success
      || !isRealIsoDate(parsed.data.allotmentDate)
      || !isRealIsoDate(parsed.data.signatoryDate)
    ) {
      return NextResponse.json({ error: '请填完整配售新股资料，以及配发日期和签署人。' }, { status: 400 })
    }
    const company = await loadWorkTaskCompany(session!.user.id, session!.user.role, parsed.data.companyId)
    if (!company) return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })
    const input: ShareAllotmentInput = {
      companyNameEn: parsed.data.companyNameEn,
      companyNameZh: parsed.data.companyNameZh,
      companyNo: parsed.data.companyNo,
      brn: parsed.data.brn,
      allotmentDate: parsed.data.allotmentDate,
      allotteeName: parsed.data.allotteeName,
      allotteeNameZh: parsed.data.allotteeNameZh,
      allotteeAddress: parsed.data.allotteeAddress,
      numberOfShares: parsed.data.numberOfShares,
      shareClass: parsed.data.shareClass,
      currency: parsed.data.currency,
      amountPaidPerShare: parsed.data.amountPaidPerShare,
      amountUnpaidPerShare: parsed.data.amountUnpaidPerShare,
      consideration: parsed.data.consideration,
      paidStatus: parsed.data.paidStatus,
      certNo: parsed.data.certNo,
      directorName1: parsed.data.directorName1,
      directorName2: parsed.data.directorName2,
      meetingTime: parsed.data.meetingTime,
      meetingPlace: parsed.data.meetingPlace,
      companySecretary: parsed.data.companySecretary,
      useCommonSeal: parsed.data.useCommonSeal,
      capitalIncreaseAmount: parsed.data.capitalIncreaseAmount || parsed.data.consideration,
      issuedTotalNumber: parsed.data.issuedTotalNumber,
      issuedTotalAmount: parsed.data.issuedTotalAmount,
      issuedPaidUp: parsed.data.issuedPaidUp,
      issuedUnpaid: parsed.data.issuedUnpaid,
      signatoryName: parsed.data.signatoryName,
      signatoryCapacity: parsed.data.signatoryCapacity,
      signatoryDate: parsed.data.signatoryDate,
      presentorNameZh: parsed.data.presentorNameZh,
      presentorNameEn: parsed.data.presentorNameEn,
      presentorAddress: parsed.data.presentorAddress,
      presentorTel: parsed.data.presentorTel,
      presentorFax: parsed.data.presentorFax,
      presentorEmail: parsed.data.presentorEmail,
      presentorReference: parsed.data.presentorReference,
    }
    try {
      const task = await createShareAllotmentTask(parsed.data.companyId, input, session!.user.id)
      return NextResponse.json({ id: task.id, taskNumber: task.taskNumber })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '生成文件失败。'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
  if (body && typeof body === 'object' && (body as { kind?: string }).kind === 'COMPANY_NAME_CHANGE') {
    const parsed = nameChangeSchema.safeParse(body)
    if (!parsed.success || (!parsed.data.newCompanyNameEn && !parsed.data.newCompanyNameZh)) {
      return NextResponse.json({ error: '请填完整公司名称变更资料。' }, { status: 400 })
    }
    const [year, month, day] = parsed.data.changeDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return NextResponse.json({ error: '决议日期不正确。' }, { status: 400 })
    }
    const signDate = parsed.data.signatoryDate.split('-').map(Number)
    const signed = new Date(signDate[0], signDate[1] - 1, signDate[2])
    if (signed.getFullYear() !== signDate[0] || signed.getMonth() !== signDate[1] - 1 || signed.getDate() !== signDate[2]) {
      return NextResponse.json({ error: '签署日期不正确。' }, { status: 400 })
    }
    const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
    if (!(await assertCompanyAccessible(access, parsed.data.companyId))) {
      return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })
    }
    const company = await prisma.company.findFirst({
      where: { id: parsed.data.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!company) return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })
    try {
      const task = await createCompanyNameChangeTask(parsed.data.companyId, {
        companyNameEn: parsed.data.companyNameEn,
        companyNameZh: parsed.data.companyNameZh,
        companyNo: parsed.data.companyNo,
        brn: parsed.data.brn,
        newCompanyNameEn: parsed.data.newCompanyNameEn,
        newCompanyNameZh: parsed.data.newCompanyNameZh,
        changeDate: parsed.data.changeDate,
        shareholderNames: parsed.data.shareholderNames,
        signatoryName: parsed.data.signatoryName,
        signatoryCapacity: parsed.data.signatoryCapacity,
        signatoryDate: parsed.data.signatoryDate,
        presentorNameZh: parsed.data.presentorNameZh,
        presentorNameEn: parsed.data.presentorNameEn,
        presentorAddress: parsed.data.presentorAddress,
        presentorTel: parsed.data.presentorTel,
        presentorFax: parsed.data.presentorFax,
        presentorEmail: parsed.data.presentorEmail,
        presentorReference: parsed.data.presentorReference,
      }, session!.user.id)
      return NextResponse.json({ id: task.id, taskNumber: task.taskNumber })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '生成文件失败。'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '请填完整股份转让资料。' }, { status: 400 })
  }

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, parsed.data.companyId))) {
    return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })
  }
  const company = await prisma.company.findFirst({
    where: { id: parsed.data.companyId, deletedAt: null },
    select: { id: true },
  })
  if (!company) return NextResponse.json({ error: '找不到这家公司。' }, { status: 404 })

  const [year, month, day] = parsed.data.transferDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return NextResponse.json({ error: '转让日期不正确。' }, { status: 400 })
  }

  const input: ShareTransferInput = {
    companyNameEn: parsed.data.companyNameEn,
    companyNameZh: parsed.data.companyNameZh,
    brNo: parsed.data.brNo,
    companyNo: parsed.data.companyNo,
    transferDate: parsed.data.transferDate,
    transferor: parsed.data.transferor,
    transferee: parsed.data.transferee,
    numberOfShares: parsed.data.numberOfShares,
    shareClass: parsed.data.shareClass,
    parValue: parsed.data.parValue,
    consideration: parsed.data.consideration,
    shareNumbers: parsed.data.shareNumbers,
    oldCertNo: parsed.data.oldCertNo,
    newCertNo: parsed.data.newCertNo,
    directorName: parsed.data.directorName,
    paidStatus: parsed.data.paidStatus,
    paidAmount: parsed.data.paidAmount,
    useCommonSeal: parsed.data.useCommonSeal,
    documents: SHARE_TRANSFER_DOCUMENTS.map(doc => doc.key).filter(key => parsed.data.documents.includes(key)),
  }

  try {
    const task = await createShareTransferTask(parsed.data.companyId, input, session!.user.id)
    return NextResponse.json({ id: task.id, taskNumber: task.taskNumber })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '生成文件失败。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
