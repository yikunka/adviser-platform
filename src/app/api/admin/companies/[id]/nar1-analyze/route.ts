import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  analyzeNAR1FromBuffer,
  mapNAR1AnalysisForUi,
} from '@/lib/company/nar1-analysis'

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
])
const MAX_FILE_SIZE = 10 * 1024 * 1024

function resolveMimeType(file: File): string | null {
  if (ALLOWED_TYPES.has(file.type)) return file.type
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  try {
    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '未提供文件' }, { status: 400 })
    }

    const mimeType = resolveMimeType(file)
    if (!mimeType) {
      return NextResponse.json(
        { error: '不支持的文件格式，仅支持 PDF、JPG、PNG' },
        { status: 400 },
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '文件过大，最大 10MB' }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        directors: true,
        significantControllers: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: '公司不存在' }, { status: 404 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const analysis = await analyzeNAR1FromBuffer(bytes, file.name, mimeType)
    const data = mapNAR1AnalysisForUi(analysis)

    return NextResponse.json({
      success: true,
      data,
      source: analysis.source,
      companyNameEn: analysis.companyNameEn,
      companyNameZh: analysis.companyNameZh,
      companyNumber: analysis.companyNumber,
      existingDirectorsCount: company.directors.length,
      existingSccCount: company.significantControllers.length,
    })
  } catch (err) {
    console.error('[nar1-analyze] Error:', err)
    const message = err instanceof Error ? err.message : 'Analysis failed'
    if (message.includes('API key')) {
      return NextResponse.json(
        { error: '未配置 DASHSCOPE_API_KEY，请在 .env.local 中设置阿里云百炼 API Key' },
        { status: 503 },
      )
    }
    if (message.includes('Bailian API returned')) {
      return NextResponse.json({ error: `百炼 API 调用失败：${message}` }, { status: 502 })
    }
    return NextResponse.json({ error: 'NAR1 分析失败，请稍后重试' }, { status: 500 })
  }
}
