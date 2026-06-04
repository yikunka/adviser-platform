import { NextRequest, NextResponse } from 'next/server'
import type { FeedbackAdapter } from '../types'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'application/pdf': 'pdf', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
}
const MAX_SIZE = 10 * 1024 * 1024

function resolveContentType(file: File): string | null {
  if (ALLOWED_TYPES[file.type]) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  }
  const resolved = byExt[ext]
  return resolved && ALLOWED_TYPES[resolved] ? resolved : null
}

export function createUploadRoute(adapter: FeedbackAdapter) {
  return {
    async POST(req: NextRequest) {
      if (!adapter.uploadFile) {
        return NextResponse.json({ error: 'File upload is not configured for this system.' }, { status: 501 })
      }

      const session = await adapter.getSession()
      if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const formData = await req.formData().catch(() => null)
      const file = formData?.get('file') as File | null
      if (!file) return NextResponse.json({ error: '未提供文件' }, { status: 400 })

      const contentType = resolveContentType(file)
      if (!contentType) {
        return NextResponse.json({ error: '不支持的文件格式。支持图片 (JPG/PNG/GIF/WEBP)、PDF、Word、TXT' }, { status: 400 })
      }
      if (file.size > MAX_SIZE) return NextResponse.json({ error: '文件过大，最大支持 10MB' }, { status: 400 })

      const result = await adapter.uploadFile(file, session.user.id)
      return NextResponse.json(result)
    },
  }
}
