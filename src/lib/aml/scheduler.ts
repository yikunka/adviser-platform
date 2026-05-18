import cron from 'node-cron'
import { ingestAllSources } from './ingester'
import { screenAll } from './screener'
import { prisma } from '@/lib/db/prisma'
import { createNotification } from '@/lib/notifications'
import { generateMonthlyDdrForActiveCompanies } from '@/lib/docgen/monthly-ddr'

let started = false

async function checkAnnualReturnDeadlines() {
  const today = new Date()
  const windows = [30, 14, 7]

  for (const days of windows) {
    const target = new Date(today)
    target.setDate(target.getDate() + days)
    const from = new Date(target); from.setHours(0, 0, 0, 0)
    const to = new Date(target); to.setHours(23, 59, 59, 999)

    const companies = await prisma.company.findMany({
      where: {
        status: 'ACTIVE',
        annualReturnDate: { gte: from, lte: to },
        clientUserId: { not: null },
      },
      include: { clientUser: { select: { id: true, email: true, nameEn: true } } },
    })

    for (const co of companies) {
      if (!co.clientUser) continue
      const message = `Annual return for ${co.nameEn} is due in ${days} days (${co.annualReturnDate?.toISOString().split('T')[0]}).`
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

  cron.schedule('0 0 1 * *', async () => {
    console.log('[Scheduler] Starting monthly DDR generation')
    try {
      const result = await generateMonthlyDdrForActiveCompanies()
      console.log(`[Scheduler] Monthly DDR complete. Generated: ${result.generated}. Skipped: ${result.skipped}. Errors: ${result.errors.length}`)
      for (const error of result.errors) console.error('[Scheduler] Monthly DDR error:', error)
    } catch (err) {
      console.error('[Scheduler] Monthly DDR job failed:', err)
    }
  }, { timezone: 'Asia/Hong_Kong' })

  console.log('[Scheduler] Scheduled daily job at 02:00 HKT and monthly DDR at 00:00 HKT on day 1')
}
