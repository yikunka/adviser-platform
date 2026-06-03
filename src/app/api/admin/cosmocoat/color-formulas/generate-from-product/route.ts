import { NextResponse } from 'next/server'

/** Removed: generate-from-product is no longer available. */
export async function POST() {
  return NextResponse.json({ error: '从产品生成功能已移除' }, { status: 410 })
}
