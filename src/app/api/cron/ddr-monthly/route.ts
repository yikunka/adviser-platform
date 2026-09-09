import { NextRequest, NextResponse } from 'next/server'

/**
 * Monthly auto DDR generation is disabled.
 * Staff generate company/person DDR manually each calendar quarter;
 * the admin dashboard lists due / overdue items.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    generated: 0,
    skipped: 0,
    errors: [],
    disabled: true,
    message: 'Monthly auto DDR is disabled. Generate DDR manually each calendar quarter.',
  })
}
