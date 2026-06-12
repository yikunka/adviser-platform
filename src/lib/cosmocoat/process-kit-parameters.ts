function formatValue(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const trimmed = String(value).trim()
  return trimmed || null
}

function formatWithUnit(
  value: number | string | null | undefined,
  unit: string,
  unitPattern: RegExp,
): string | null {
  const formatted = formatValue(value)
  if (!formatted) return null
  return unitPattern.test(formatted) ? formatted : `${formatted} ${unit}`
}

export function formatIrMinutes(value: number | string | null | undefined): string | null {
  return formatWithUnit(value, 'min', /(分钟|分|min|m\b)/i)
}

export function formatIrTemperature(value: number | string | null | undefined): string | null {
  return formatWithUnit(value, '°C', /(°C|℃|\bC\b)/i)
}

export function formatUvEnergy(value: number | string | null | undefined): string | null {
  return formatWithUnit(value, 'MJ/CM²', /(MJ\/?CM²|MJ\/?CM2|mJ\/?cm²|mJ\/?cm2)/i)
}

export function formatFilmThickness(value: number | string | null | undefined): string | null {
  return formatWithUnit(value, 'μm', /(μm|µm|um|UM)/i)
}

export function displayProcessParameter(
  value: number | string | null | undefined,
  formatter: (v: number | string | null | undefined) => string | null,
  fallback = '—',
): string {
  return formatter(value) ?? fallback
}

export function formatIrParametersDisplay(
  irMinutes: number | string | null | undefined,
  irTemperature: number | string | null | undefined,
  fallback = '—',
): string {
  return `${displayProcessParameter(irMinutes, formatIrMinutes, fallback)} / ${displayProcessParameter(irTemperature, formatIrTemperature, fallback)}`
}
