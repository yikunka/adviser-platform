/**
 * CLI: download OFAC SDN.XML to aml-downloads/9_YYYY-MM-DD.xml
 * (same fetch as Admin “下载制裁名单” for seq 9 — see src/lib/aml/ofacSdn.ts)
 *
 *   pnpm run aml:download-ofac
 *   pnpm exec tsx scripts/download-ofac-sdn.ts 2026-04-24
 */
import fs from 'fs'
import path from 'path'
import {
  fetchOfacSdnListBuffer,
  OFAC_SDN_DEFAULT_URL,
} from '../src/lib/aml/ofacSdn'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function main() {
  const arg = process.argv[2]
  const dateStr = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : ymd(new Date())
  const outDir = path.join(process.cwd(), 'aml-downloads')
  const outFile = path.join(outDir, `9_${dateStr}.xml`)

  fs.mkdirSync(outDir, { recursive: true })

  const url = process.env.OFAC_URL || OFAC_SDN_DEFAULT_URL
  console.log(`[OFAC] GET ${url}`)
  console.log(`[OFAC] → ${outFile}`)

  const buf = await fetchOfacSdnListBuffer(url)
  fs.writeFileSync(outFile, buf)
  const mb = (buf.length / (1024 * 1024)).toFixed(2)
  console.log(`[OFAC] OK ${buf.length} bytes (~${mb} MB)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
