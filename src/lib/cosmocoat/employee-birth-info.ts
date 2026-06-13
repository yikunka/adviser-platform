export type CosEmployeeBirthInfo = {
  lunarYear: number
  yearHeavenlyStem: string
  yearEarthlyBranch: string
  sexagenaryYear: string
  dayHeavenlyStem: string
  dayEarthlyBranch: string
  sexagenaryDay: string
  dayMaster: string
  fiveElement: string
  zodiac: string
}

const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
const STEM_ELEMENTS = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'] as const
const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'] as const

let chineseYearFormatter: Intl.DateTimeFormat | null | undefined

function getChineseYearFormatter() {
  if (chineseYearFormatter !== undefined) return chineseYearFormatter
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-chinese', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    })
    chineseYearFormatter = formatter.resolvedOptions().calendar === 'chinese' ? formatter : null
  } catch {
    chineseYearFormatter = null
  }
  return chineseYearFormatter
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}

function parseYmdDate(value?: string | null) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day, 12))

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function resolveChineseLunarYear(date: Date) {
  const formatter = getChineseYearFormatter()
  if (!formatter) return date.getUTCFullYear()

  const relatedYear = formatter
    .formatToParts(date)
    .find(part => String(part.type) === 'relatedYear')
    ?.value

  const parsed = Number(relatedYear)
  return Number.isInteger(parsed) ? parsed : date.getUTCFullYear()
}

function gregorianToJulianDayNumber(date: Date) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + (12 * a) - 3

  return day
    + Math.floor(((153 * m) + 2) / 5)
    + (365 * y)
    + Math.floor(y / 4)
    - Math.floor(y / 100)
    + Math.floor(y / 400)
    - 32045
}

export function resolveCosEmployeeBirthInfo(value?: string | null): CosEmployeeBirthInfo | null {
  const date = parseYmdDate(value)
  if (!date) return null

  const lunarYear = resolveChineseLunarYear(date)
  const yearStemIndex = positiveModulo(lunarYear - 4, 10)
  const yearBranchIndex = positiveModulo(lunarYear - 4, 12)
  const yearHeavenlyStem = HEAVENLY_STEMS[yearStemIndex]
  const yearEarthlyBranch = EARTHLY_BRANCHES[yearBranchIndex]

  // Sexagenary day numbering follows the standard Julian day mapping:
  // stem = 1 + mod(JDN - 1, 10), branch = 1 + mod(JDN + 1, 12).
  const julianDayNumber = gregorianToJulianDayNumber(date)
  const dayStemIndex = positiveModulo(julianDayNumber - 1, 10)
  const dayBranchIndex = positiveModulo(julianDayNumber + 1, 12)
  const dayHeavenlyStem = HEAVENLY_STEMS[dayStemIndex]
  const dayEarthlyBranch = EARTHLY_BRANCHES[dayBranchIndex]

  return {
    lunarYear,
    yearHeavenlyStem,
    yearEarthlyBranch,
    sexagenaryYear: `${yearHeavenlyStem}${yearEarthlyBranch}`,
    dayHeavenlyStem,
    dayEarthlyBranch,
    sexagenaryDay: `${dayHeavenlyStem}${dayEarthlyBranch}`,
    dayMaster: dayHeavenlyStem,
    fiveElement: STEM_ELEMENTS[dayStemIndex],
    zodiac: ZODIACS[yearBranchIndex],
  }
}
