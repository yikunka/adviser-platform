import crypto from 'crypto'
import type { AdvWorkTaskKind } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import { deleteFromR2, uploadToR2 } from '@/lib/storage/r2'
import {
  renderAccountingReference,
  renderRegisteredOffice,
  renderRegisterLocation,
  type AccountingReferenceInput,
  type RegisteredOfficeInput,
  type RegisterLocationInput,
} from '@/lib/work-tasks/company-record-change'

const PDF_MIME = 'application/pdf'

type RenderedFile = { templateKey: string; fileName: string; buffer: Buffer }

async function storeTask(companyId: string, kind: AdvWorkTaskKind, payload: object, userId: string, file: RenderedFile) {
  const year = new Date().getFullYear()
  const prefix = `WT-${year}-`
  const task = await prisma.$transaction(async tx => {
    const latest = await tx.advWorkTask.findFirst({
      where: { taskNumber: { startsWith: prefix } },
      orderBy: { taskNumber: 'desc' },
      select: { taskNumber: true },
    })
    const seq = Number(latest?.taskNumber.slice(prefix.length) ?? '0')
    const taskNumber = `${prefix}${String((Number.isFinite(seq) ? seq : 0) + 1).padStart(5, '0')}`
    return tx.advWorkTask.create({
      data: {
        taskNumber,
        kind,
        companyId,
        payload: { companyId, ...payload },
        createdById: userId,
      },
      select: { id: true, taskNumber: true },
    })
  })

  const storageKey = `adviser/work-tasks/${task.id}/${crypto.randomUUID()}.pdf`
  try {
    await uploadToR2(storageKey, file.buffer, PDF_MIME, {
      contentDisposition: contentDispositionHeader('attachment', file.fileName),
    })
    await prisma.advWorkTaskFile.create({
      data: {
        taskId: task.id,
        templateKey: file.templateKey,
        fileName: file.fileName,
        storageKey,
        mimeType: PDF_MIME,
        fileSize: file.buffer.byteLength,
      },
    })
  } catch (error) {
    await deleteFromR2(storageKey).catch(() => undefined)
    await prisma.advWorkTask.delete({ where: { id: task.id } }).catch(() => undefined)
    throw error
  }
  return task
}

export function createRegisteredOfficeTask(companyId: string, input: RegisteredOfficeInput, userId: string) {
  return renderRegisteredOffice(input).then(file => storeTask(companyId, 'REGISTERED_OFFICE_ADDRESS', input, userId, file))
}

export function createRegisterLocationTask(companyId: string, input: RegisterLocationInput, userId: string) {
  return renderRegisterLocation(input).then(file => storeTask(companyId, 'REGISTER_LOCATION', input, userId, file))
}

export function createAccountingReferenceTask(companyId: string, input: AccountingReferenceInput, userId: string) {
  return renderAccountingReference(input).then(file => storeTask(companyId, 'ACCOUNTING_REFERENCE_DATE', input, userId, file))
}
