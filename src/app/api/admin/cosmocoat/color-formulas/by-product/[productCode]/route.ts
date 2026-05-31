import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireRole } from '@/lib/auth/rbac'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productCode: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const { productCode: rawProductCode } = await params
  const productCode = decodeURIComponent(rawProductCode ?? '').trim()

  if (!productCode) {
    return NextResponse.json({ error: '未指定产品编号' }, { status: 400 })
  }

  try {
    const product = await prisma.cosTableFactoryProduct.findUnique({
      where: { productCode },
      include: {
        colorFormulas: {
          select: {
            id: true,
            code: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ 
        formulas: [],
        message: `未找到产品编号 "${productCode}"`
      })
    }

    return NextResponse.json({
      formulaCount: product.colorFormulas.length,
      formulas: product.colorFormulas,
    })
  } catch (err) {
    console.error('Error fetching color formulas by product:', err)
    return NextResponse.json({ error: '查询配方失败' }, { status: 500 })
  }
}
