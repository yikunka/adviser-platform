import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { deleteFromR2 } from '@/lib/storage/r2'

type FileType = 'tds' | 'msds'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const { id } = await params
  const fileType = req.nextUrl.searchParams.get('type') as FileType | null

  if (!fileType || !['tds', 'msds'].includes(fileType)) {
    return NextResponse.json({ error: '无效的文件类型，必须是 tds 或 msds' }, { status: 400 })
  }

  const rawMaterial = await prisma.cosTableRawMaterial.findUnique({
    where: { id },
    select: { id: true, tdsFileKey: true, msdsFileKey: true },
  })

  if (!rawMaterial) {
    return NextResponse.json({ error: '原料不存在' }, { status: 404 })
  }

  const fileKey = fileType === 'tds' ? rawMaterial.tdsFileKey : rawMaterial.msdsFileKey
  if (!fileKey) {
    return NextResponse.json({ error: `${fileType.toUpperCase()} 文件不存在` }, { status: 404 })
  }

  try {
    await deleteFromR2(fileKey).catch(err => {
      console.warn(`OSS delete failed for ${fileKey}:`, err)
    })

    await prisma.cosTableRawMaterial.update({
      where: { id },
      data: fileType === 'tds' ? { tdsFileKey: null } : { msdsFileKey: null },
    })

    return NextResponse.json({ success: true, fileType })
  } catch (err) {
    console.error('File delete error:', err)
    return NextResponse.json({ error: '删除文件失败' }, { status: 500 })
  }
}
