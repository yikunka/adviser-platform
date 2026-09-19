const BELOW_TWENTY = [
  'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
]

const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

function belowThousand(n: number): string {
  if (n < 20) return BELOW_TWENTY[n]
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)]
    const rest = n % 10
    return rest === 0 ? tens : `${tens}-${BELOW_TWENTY[rest]}`
  }
  const hundreds = `${BELOW_TWENTY[Math.floor(n / 100)]} HUNDRED`
  const rest = n % 100
  return rest === 0 ? hundreds : `${hundreds} AND ${belowThousand(rest)}`
}

/** English words for a non-negative integer, used on share certificates. */
export function integerToWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999_999_999) {
    throw new Error('Share count must be a whole number from 0 to 999,999,999')
  }
  if (value < 1000) return belowThousand(value)
  const millions = Math.floor(value / 1_000_000)
  const thousands = Math.floor((value % 1_000_000) / 1000)
  const rest = value % 1000
  const parts: string[] = []
  if (millions > 0) parts.push(`${belowThousand(millions)} MILLION`)
  if (thousands > 0) parts.push(`${belowThousand(thousands)} THOUSAND`)
  if (rest > 0) parts.push(belowThousand(rest))
  return parts.join(' ')
}
