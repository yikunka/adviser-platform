import { NextResponse } from 'next/server'

/** @deprecated Browser print is used instead — see color formula detail page. */
export async function GET() {
  return NextResponse.json(
    { error: '调色配方打印已改为浏览器直接打印，请从配方详情页点击「打印文件」。' },
    { status: 410 },
  )
}
