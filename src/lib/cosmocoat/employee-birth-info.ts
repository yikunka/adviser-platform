export type CosEmployeeBirthInfo = {
  lunarYear: number
  heavenlyStem: string
  earthlyBranch: string
  sexagenaryYear: string
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

export function resolveCosEmployeeBirthInfo(value?: string | null): CosEmployeeBirthInfo | null {
  const date = parseYmdDate(value)
  if (!date) return null

  const lunarYear = resolveChineseLunarYear(date)
  const stemIndex = positiveModulo(lunarYear - 4, 10)
  const branchIndex = positiveModulo(lunarYear - 4, 12)
  const heavenlyStem = HEAVENLY_STEMS[stemIndex]
  const earthlyBranch = EARTHLY_BRANCHES[branchIndex]

  return {
    lunarYear,
    heavenlyStem,
    earthlyBranch,
    sexagenaryYear: `${heavenlyStem}${earthlyBranch}`,
    fiveElement: STEM_ELEMENTS[stemIndex],
    zodiac: ZODIACS[branchIndex],
  }
}
