import { NextRequest, NextResponse } from 'next/server'
import { generateMonthlyDdrForActiveCompanies } from '@/lib/docgen/monthly-ddr'

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await generateMonthlyDdrForActiveCompanies()
  return NextResponse.json(result)
}
