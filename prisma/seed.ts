import 'dotenv/config'
import { PrismaClient, UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── Seed AML Sources (13 lists) ───────────────────────────────────
  const amlSources = [
    { seqNo: 1,  nameEn: 'UN Sanctions List (English)',                nameZh: '聯合國制裁名單（英文）',              sourceUrl: 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',                                                                                                     format: 'XML' as const },
    { seqNo: 2,  nameEn: 'UN Sanctions List (Chinese)',                nameZh: '聯合國制裁名單（中文）',              sourceUrl: 'https://scsanctions.un.org/resources/xml/ch/consolidated.xml',                                                                                                     format: 'XML' as const },
    { seqNo: 3,  nameEn: 'ICAC Sanctions List (English)',              nameZh: '廉政公署制裁名單（英文）',            sourceUrl: 'https://www.icac.org.hk/datagovhk/opendata/ops/wanted_person/icac_wanted_person_en.csv',                                                                           format: 'CSV' as const },
    { seqNo: 4,  nameEn: 'ICAC Sanctions List (Chinese)',              nameZh: '廉政公署制裁名單（中文）',            sourceUrl: 'https://www.icac.org.hk/datagovhk/opendata/ops/wanted_person/icac_wanted_person_tc.csv',                                                                           format: 'CSV' as const },
    { seqNo: 5,  nameEn: 'HK Police Wanted Persons (English)',         nameZh: '香港警務處制裁名單（英文）',          sourceUrl: 'http://www.police.gov.hk/info/appeals_public/wanted_persons/w_en.xml',                                                                                              format: 'XML' as const },
    { seqNo: 6,  nameEn: 'HK Police Wanted Persons (Chinese)',         nameZh: '香港警務處制裁名單（中文）',          sourceUrl: 'http://www.police.gov.hk/info/appeals_public/wanted_persons/w_tc.xml',                                                                                              format: 'XML' as const },
    { seqNo: 7,  nameEn: 'HK Police Other Notices (English)',          nameZh: '香港警務處其他制裁名單（英文）',      sourceUrl: 'https://www.police.gov.hk/info/appeals_public/other_reward_notice/orn_en.xml',                                                                                       format: 'XML' as const },
    { seqNo: 8,  nameEn: 'HK Police Other Notices (Chinese)',          nameZh: '香港警務處其他制裁名單（中文）',      sourceUrl: 'http://www.police.gov.hk/info/appeals_public/other_reward_notice/orn_tc.xml',                                                                                        format: 'XML' as const },
    { seqNo: 9,  nameEn: 'OFAC SDN List (English)',                    nameZh: '美國財政部海外資產控制辦公室制裁名單（英文）', sourceUrl: 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML',                                                                   format: 'XML' as const },
    { seqNo: 10, nameEn: 'EU Sanctions List (English)',                nameZh: '歐盟制裁名單（英文）',               sourceUrl: 'https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList/content?token=dG9rZW4tMjAxNw',                                                               format: 'CSV' as const },
    { seqNo: 11, nameEn: 'Canada Sanctions List (English)',            nameZh: '加拿大制裁名單（英文）',             sourceUrl: 'https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml',                         format: 'XML' as const },
    { seqNo: 12, nameEn: 'Australia Sanctions List (English)',         nameZh: '澳洲制裁名單（英文）',               sourceUrl: 'https://www.dfat.gov.au/sites/default/files/Australian_Sanctions_Consolidated_List.xlsx',                                                                          format: 'XLSX' as const },
    // Official World Bank JSON now requires an API subscription key; use OpenSanctions daily mirror (same underlying list).
    { seqNo: 13, nameEn: 'World Bank Sanctions List (English)',        nameZh: '世界銀行制裁名單（英文）',           sourceUrl: 'https://data.opensanctions.org/datasets/latest/worldbank_debarred/targets.simple.csv',                                                                             format: 'CSV' as const },
  ]

  for (const source of amlSources) {
    await prisma.aMLSource.upsert({
      where: { seqNo: source.seqNo },
      update: {
        sourceUrl: source.sourceUrl,
        format: source.format,
        nameEn: source.nameEn,
        nameZh: source.nameZh,
      },
      create: source,
    })
  }
  console.log(`✓ Seeded ${amlSources.length} AML sources`)

  // ── Seed default Super Admin ───────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@6amadvise.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe@2026!'
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      nameEn: '6AM Admin',
      nameZh: '管理員',
      role: UserRole.SUPER_ADMIN,
      emailVerified: new Date(),
    },
  })
  console.log(`✓ Seeded Super Admin: ${adminEmail}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
