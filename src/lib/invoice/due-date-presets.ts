export type InvoiceDueDatePreset = 'CASH' | 'MONTH_END' | 'MONTH_END_30' | 'MONTH_END_60'

function parseYmdDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }
  return parsed
}

function formatYmdDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function computeInvoiceDueDate(
  preset: InvoiceDueDatePreset,
  referenceDate: string | null | undefined,
  fallbackDate = new Date(),
): string {
  const baseDate = parseYmdDate(referenceDate) ?? fallbackDate
  const monthEnd = endOfMonth(baseDate)

  if (preset === 'CASH') return formatYmdDate(baseDate)
  if (preset === 'MONTH_END') return formatYmdDate(monthEnd)
  if (preset === 'MONTH_END_30') return formatYmdDate(addDays(monthEnd, 30))
  return formatYmdDate(addDays(monthEnd, 60))
}
