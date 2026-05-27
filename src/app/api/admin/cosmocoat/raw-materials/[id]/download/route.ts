import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getSignedDownloadUrl } from '@/lib/storage/r2'

type FileType = 'tds' | 'msds'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const { id } = await params
  const searchParams = req.nextUrl.searchParams
  const fileType = searchParams.get('type') as FileType | null

  if (!fileType || !['tds', 'msds'].includes(fileType)) {
    return NextResponse.json({ error: '无效的文件类型，必须是 tds 或 msds' }, { status: 400 })
  }

  // Check if raw material exists
  const rawMaterial = await prisma.cosTableRawMaterial.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      productionCode: true,
      tdsFileKey: true,
      msdsFileKey: true,
    },
  })

  if (!rawMaterial) {
    return NextResponse.json({ error: '原料不存在' }, { status: 404 })
  }

  const fileKey = fileType === 'tds' ? rawMaterial.tdsFileKey : rawMaterial.msdsFileKey

  if (!fileKey) {
    return NextResponse.json(
      { error: `${fileType.toUpperCase()} 文件不存在` },
      { status: 404 },
    )
  }

  try {
    // Generate a signed download URL (valid for 15 minutes)
    const downloadUrl = await getSignedDownloadUrl(fileKey, 900, {
      responseContentDisposition: `attachment; filename="${rawMaterial.productionCode}_${rawMaterial.name}_${fileType.toUpperCase()}"`,
    })

    return NextResponse.json({
      success: true,
      downloadUrl,
      fileType,
      fileKey,
    })
  } catch (err) {
    console.error('File download error:', err)
    return NextResponse.json({ error: '生成下载链接失败' }, { status: 500 })
  }
}
