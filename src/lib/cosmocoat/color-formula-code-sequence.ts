/** New color formula suffixes start at 5001; legacy formulas keep 0001–4999 unchanged. */
export const COLOR_FORMULA_NEW_SEQUENCE_START = 5001

const FOUR_DIGIT_SUFFIX = /^\d{4}$/

export function maxColorFormulaSuffixForProduct(
  productCode: string,
  codes: Iterable<string>,
  minSequence = COLOR_FORMULA_NEW_SEQUENCE_START,
): number {
  const prefix = `${productCode}-`
  let max = minSequence - 1

  for (const code of codes) {
    if (!code.startsWith(prefix)) continue
    const suffix = code.slice(prefix.length)
    if (!FOUR_DIGIT_SUFFIX.test(suffix)) continue
    const num = Number(suffix)
    if (num < minSequence) continue
    max = Math.max(max, num)
  }

  return max
}

export function computeNextColorFormulaCodeForProduct(
  productCode: string,
  codes: Iterable<string>,
): string {
  const nextSuffix = maxColorFormulaSuffixForProduct(productCode, codes) + 1
  return `${productCode}-${String(nextSuffix).padStart(4, '0')}`
}
