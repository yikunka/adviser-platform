import { NextRequest, NextResponse } from 'next/server'
import { ingestAllSources } from '@/lib/aml/ingester'
import { screenAll } from '@/lib/aml/screener'

// Called by the node-cron scheduler via HTTP or directly
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ingestResult = await ingestAllSources()
  const screenResult = await screenAll('SCHEDULED')

  return NextResponse.json({ ingest: ingestResult, screen: screenResult })
}
