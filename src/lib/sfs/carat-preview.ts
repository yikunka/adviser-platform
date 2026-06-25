const MIN_CARAT = 0.5
const MAX_CARAT = 3
const MIN_DIAMETER = 28
const MAX_DIAMETER = 64
const DEFAULT_DIAMETER = 40

export function getCaratPreviewDiameter(carat: string): number {
  const value = Number(carat)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_DIAMETER
  if (value <= MIN_CARAT) return MIN_DIAMETER
  if (value >= MAX_CARAT) return MAX_DIAMETER

  const ratio = (value - MIN_CARAT) / (MAX_CARAT - MIN_CARAT)
  return Math.round(MIN_DIAMETER + ratio * (MAX_DIAMETER - MIN_DIAMETER))
}
