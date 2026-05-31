/**
 * One-time cleanup: remove all AMLRecord rows (and their AMLAlert rows) for given source seqNos.
 * Use after changing recordHash strategy (e.g. UN name → DATAID) to drop duplicate "old hash" rows.
 *
 *   npx tsx scripts/reset-aml-by-seq.ts 1 2
 *
 * Then run Admin → 提取制裁数据 (or full ingest) for those lists.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

async function main() {
  const raw = process.argv.slice(2).filter(s => /^\d+$/.test(s))
  if (raw.length === 0) {
    console.error('Usage: npx tsx scripts/reset-aml-by-seq.ts <seqNo> [seqNo ...]')
    process.exit(1)
  }
  const seqNos = raw.map(n => parseInt(n, 10))
  for (const seqNo of seqNos) {
    const src = await prisma.aMLSource.findUnique({ where: { seqNo } })
    if (!src) {
      console.warn(`[skip] No aml_sources with seqNo=${seqNo}`)
      continue
    }
    const nAlerts = await prisma.aMLAlert.count({
      where: { amlRecord: { sourceId: src.id } },
    })
    const nRec = await prisma.aMLRecord.count({ where: { sourceId: src.id } })
    const dAlerts = await prisma.aMLAlert.deleteMany({
      where: { amlRecord: { sourceId: src.id } },
    })
    const dRec = await prisma.aMLRecord.deleteMany({ where: { sourceId: src.id } })
    await prisma.aMLSource.update({ where: { id: src.id }, data: { lastFetched: null } })
    console.log(
      `[${seqNo}] ${src.nameEn}: removed ${dRec.count} records, ${dAlerts.count} alerts (had ${nRec} rows, ${nAlerts} alerts)`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
