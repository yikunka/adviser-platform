import crypto from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import { deleteFromR2, uploadToR2 } from '@/lib/storage/r2'
import { renderCompanyNameChangeDocument, type CompanyNameChangeInput } from '@/lib/work-tasks/company-name-change'
import { nnc2FileName, renderNnc2 } from '@/lib/work-tasks/nnc2'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PDF_MIME = 'application/pdf'

export async function createCompanyNameChangeTask(companyId: string, input: CompanyNameChangeInput, userId: string) {
  const resolution = await renderCompanyNameChangeDocument(input)
  const nnc2 = await renderNnc2(input)
  const files = [
    { ...resolution, mimeType: DOCX_MIME },
    {
      templateKey: 'nnc2',
      fileName: nnc2FileName(input.companyNameEn),
      buffer: nnc2,
      mimeType: PDF_MIME,
    },
  ]
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

  const uploaded: string[] = []
  try {
    for (const file of files) {
      const storageKey = `adviser/work-tasks/${task.id}/${crypto.randomUUID()}${file.mimeType === PDF_MIME ? '.pdf' : '.docx'}`
      await uploadToR2(storageKey, file.buffer, file.mimeType, {
        contentDisposition: contentDispositionHeader('attachment', file.fileName),
      })
      uploaded.push(storageKey)
      await prisma.advWorkTaskFile.create({
        data: {
          taskId: task.id,
          templateKey: file.templateKey,
          fileName: file.fileName,
          storageKey,
          mimeType: file.mimeType,
          fileSize: file.buffer.byteLength,
        },
      })
    }
  } catch (error) {
    await Promise.all(uploaded.map(key => deleteFromR2(key).catch(() => undefined)))
    await prisma.advWorkTask.delete({ where: { id: task.id } }).catch(() => undefined)
    throw error
  }

  return task
}
