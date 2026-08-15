import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import fs from 'fs'
import path from 'path'
import {
  FATF_CALL_FOR_ACTION_KEY,
  FATF_INCREASED_MONITORING_KEY,
} from '@/lib/aml/fatfLists'

type FatfJson = {
  asOf?: string
  list?: string
  titleEn?: string
  titleZh?: string
  referenceUrl?: string
  entries?: Array<{
    name?: string
    aliases?: string[]
    listingReason?: string
    listingDate?: string
  }>
}

function readFatfJson(fileName: string): FatfJson {
  const filePath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    'src',
    'lib',
    'aml',
    'data',
    fileName,
  )
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as FatfJson
}

/**
 * GET /api/aml/fatf-lists
 * Returns FATF black (Call for Action) and grey (Increased Monitoring) lists
 * with jurisdiction entries from bundled JSON, plus DB source metadata when present.
 */
export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'aml' })
  if (error) return error

  const dbSources = await prisma.aMLSource.findMany({
    where: { seqNo: { in: [14, 15] } },
    include: { _count: { select: { records: true } } },
  })
  const bySeq = new Map(dbSources.map(s => [s.seqNo, s]))

  const specs = [
    {
      seqNo: 14,
      key: FATF_CALL_FOR_ACTION_KEY,
      file: 'fatf-call-for-action.json',
      labelZh: 'FATF 黑名單（呼籲採取行動）',
      labelEn: 'Call for Action',
    },
    {
      seqNo: 15,
      key: FATF_INCREASED_MONITORING_KEY,
      file: 'fatf-increased-monitoring.json',
      labelZh: 'FATF 灰名單（加強監控）',
      labelEn: 'Increased Monitoring',
    },
  ] as const

  const lists = specs.map(spec => {
    const json = readFatfJson(spec.file)
    const db = bySeq.get(spec.seqNo)
    return {
      seqNo: spec.seqNo,
      key: spec.key,
      labelZh: spec.labelZh,
      labelEn: spec.labelEn,
      titleEn: json.titleEn ?? spec.labelEn,
      titleZh: json.titleZh ?? spec.labelZh,
      asOf: json.asOf ?? null,
      referenceUrl: json.referenceUrl ?? null,
      sourceId: db?.id ?? null,
      lastFetched: db?.lastFetched?.toISOString() ?? null,
      recordCountInDb: db?._count.records ?? 0,
      entries: (json.entries ?? []).map(e => ({
        name: e.name ?? '',
        aliases: e.aliases ?? [],
        listingReason: e.listingReason ?? null,
        listingDate: e.listingDate ?? null,
      })),
    }
  })

  return NextResponse.json({ lists })
}
