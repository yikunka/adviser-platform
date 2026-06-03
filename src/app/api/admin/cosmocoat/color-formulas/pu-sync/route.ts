import { NextResponse } from 'next/server'

/** Removed: PU batch sync is no longer available. */
export async function POST() {
  return NextResponse.json({ error: 'PU 同步功能已移除' }, { status: 410 })
}
