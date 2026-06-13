const ID_CARD_18_REGEX = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/
const ID_CARD_15_REGEX = /^[1-9]\d{5}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}$/
const CHECK_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const
const CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'] as const

function normalizeIdCardNumber(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

function isValidCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function resolveLegacy15DigitYear(twoDigitYear: number) {
  return 1900 + twoDigitYear
}

function formatYmd(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function validate18DigitChecksum(value: string) {
  let sum = 0
  for (let i = 0; i < 17; i += 1) {
    sum += Number(value[i]) * CHECK_WEIGHTS[i]
  }
  return value[17] === CHECK_CODES[sum % 11]
}

export function validateCosEmployeeIdCardNumber(value?: string | null): string | null {
  const normalized = normalizeIdCardNumber(value)
  if (!normalized) return null

  if (ID_CARD_18_REGEX.test(normalized)) {
    if (!validate18DigitChecksum(normalized)) return '身份证号码校验位不正确'
    const year = Number(normalized.slice(6, 10))
    const month = Number(normalized.slice(10, 12))
    const day = Number(normalized.slice(12, 14))
    if (!isValidCalendarDate(year, month, day)) return '身份证号码中的出生日期无效'
    return null
  }

  if (ID_CARD_15_REGEX.test(normalized)) {
    const year = resolveLegacy15DigitYear(Number(normalized.slice(6, 8)))
    const month = Number(normalized.slice(8, 10))
    const day = Number(normalized.slice(10, 12))
    if (!isValidCalendarDate(year, month, day)) return '身份证号码中的出生日期无效'
    return null
  }

  return '请输入有效的 15 位或 18 位身份证号码'
}

export function extractBirthDateFromCosEmployeeIdCard(value?: string | null): string | null {
  const normalized = normalizeIdCardNumber(value)
  if (!normalized) return null
  if (validateCosEmployeeIdCardNumber(normalized)) return null

  if (normalized.length === 18) {
    return formatYmd(
      Number(normalized.slice(6, 10)),
      Number(normalized.slice(10, 12)),
      Number(normalized.slice(12, 14)),
    )
  }

  return formatYmd(
    resolveLegacy15DigitYear(Number(normalized.slice(6, 8))),
    Number(normalized.slice(8, 10)),
    Number(normalized.slice(10, 12)),
  )
}

export function normalizeCosEmployeeIdCardNumber(value?: string | null): string | null {
  const normalized = normalizeIdCardNumber(value)
  return normalized || null
}
