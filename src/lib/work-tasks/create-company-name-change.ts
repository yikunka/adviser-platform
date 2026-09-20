import crypto from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import { deleteFromR2, uploadToR2 } from '@/lib/storage/r2'
import { renderCompanyNameChangeDocument, type CompanyNameChangeInput } from '@/lib/work-tasks/company-name-change'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export async function createCompanyNameChangeTask(companyId: string, input: CompanyNameChangeInput, userId: string) {
  const file = await renderCompanyNameChangeDocument(input)
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
        kind: 'COMPANY_NAME_CHANGE',
        companyId,
        payload: { companyId, ...input },
        createdById: userId,
      },
      select: { id: true, taskNumber: true },
    })
  })

  const storageKey = `adviser/work-tasks/${task.id}/${crypto.randomUUID()}.docx`
  try {
    await uploadToR2(storageKey, file.buffer, DOCX_MIME, {
      contentDisposition: contentDispositionHeader('attachment', file.fileName),
    })
    await prisma.advWorkTaskFile.create({
      data: {
        taskId: task.id,
        templateKey: file.templateKey,
        fileName: file.fileName,
        storageKey,
        mimeType: DOCX_MIME,
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
