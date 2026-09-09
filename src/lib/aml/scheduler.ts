import cron from 'node-cron'
import { prisma } from '@/lib/db/prisma'
import { createNotification } from '@/lib/notifications'
import { cleanupExpiredSfsDesignUploads } from '@/lib/sfs/pending-design-uploads'

let started = false

async function checkAnnualReturnDeadlines() {
  const today = new Date()
  const windows = [30, 14, 7]

  for (const days of windows) {
    const target = new Date(today)
    target.setDate(target.getDate() + days)
    const from = new Date(target); from.setHours(0, 0, 0, 0)
    const to = new Date(target); to.setHours(23, 59, 59, 999)

    const filings = await prisma.annualFiling.findMany({
      where: {
        status: { in: ['NOT_STARTED', 'IN_PREPARATION', 'OVERDUE'] },
        filingDeadline: { gte: from, lte: to },
        company: { status: 'ACTIVE', clientUserId: { not: null } },
      },
      include: {
        company: { include: { clientUser: { select: { id: true, email: true, nameEn: true } } } },
      },
    })

    for (const filing of filings) {
      const co = filing.company
      if (!co.clientUser) continue
      const message = `Annual return for ${co.nameEn} is due in ${days} days (${filing.filingDeadline?.toISOString().split('T')[0]}).`
      await createNotification(co.clientUser.id, 'ANNUAL_RETURN_DUE', message, co.id)
      console.log(`[Scheduler] AR reminder sent for ${co.nameEn} (${days}d)`)
    }
  }
}

export function startAMLScheduler() {
  if (started) return
  started = true

  // 02:00 HKT = 18:00 UTC (HKT is UTC+8)
  cron.schedule('0 18 * * *', async () => {
    console.log('[Scheduler] Starting daily jobs')
    try {
      const { ingestAllSources } = await import('./ingester')
      const { screenAll } = await import('./screener')
      const ingestResult = await ingestAllSources()
      console.log(`[Scheduler] Ingested ${ingestResult.total} records. Errors: ${ingestResult.errors.length}`)

      const screenResult = await screenAll('SCHEDULED')
      console.log(`[Scheduler] Screened ${screenResult.keyPersons} key persons, ${screenResult.companies} companies. Hits: ${screenResult.hits}`)

      await checkAnnualReturnDeadlines()
      console.log('[Scheduler] Annual return deadline check complete')
    } catch (err) {
      console.error('[Scheduler] Job failed:', err)
    }
  }, { timezone: 'UTC' })

  // Monthly auto DDR generation removed: staff generate DDR manually each calendar quarter
  // (dashboard reminders + KYC approve requires current-quarter PERSON_DDR).

  // Run separately so an AML failure never skips private design-file cleanup.
  cron.schedule('5 18 * * *', async () => {
    try {
      const result = await cleanupExpiredSfsDesignUploads()
      console.log(`[Scheduler] SFS expired design cleanup complete. Deleted: ${result.deleted}. Failed: ${result.failed}`)
    } catch (err) {
      console.error('[Scheduler] SFS expired design cleanup failed:', err)
    }
  }, { timezone: 'UTC' })

  console.log('[Scheduler] Scheduled daily job at 02:00 HKT; quarterly DDR is manual (dashboard reminders)')
}
