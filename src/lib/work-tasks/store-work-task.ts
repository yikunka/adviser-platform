import crypto from 'crypto'
import type { AdvWorkTaskKind } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import { deleteFromR2, uploadToR2 } from '@/lib/storage/r2'

const PDF_MIME = 'application/pdf'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export type StoredWorkFile = {
  templateKey: string
  fileName: string
  buffer: Buffer
  mimeType: string
}

export async function storeWorkTask(
  companyId: string,
  kind: AdvWorkTaskKind,
  payload: object,
  userId: string,
  files: StoredWorkFile[],
) {
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

  const uploaded: string[] = []
  try {
    for (const file of files) {
      const extension = file.mimeType === PDF_MIME ? '.pdf' : '.docx'
      const storageKey = `adviser/work-tasks/${task.id}/${crypto.randomUUID()}${extension}`
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

export const WORK_FILE_MIME = { PDF_MIME, DOCX_MIME }
