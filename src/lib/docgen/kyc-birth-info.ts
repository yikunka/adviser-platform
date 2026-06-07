type BirthSource = {
  dateOfBirth?: Date | null
  placeOfBirth?: string | null
}

export type ResolvedBirthInfo = {
  dateOfBirth: Date | null
  placeOfBirth: string | null
}

function normalizePlace(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Natural-person statutory registers should use the linked KYC record as the
 * source of truth for birth data, while preserving register-level fallback data.
 */
export function resolveKycBirthInfo({
  keyPerson,
  fallback,
  naturalPerson = true,
}: {
  keyPerson?: BirthSource | null
  fallback?: BirthSource | null
  naturalPerson?: boolean
}): ResolvedBirthInfo {
  if (!naturalPerson) {
    return {
      dateOfBirth: fallback?.dateOfBirth ?? null,
      placeOfBirth: normalizePlace(fallback?.placeOfBirth),
    }
  }

  return {
    dateOfBirth: keyPerson?.dateOfBirth ?? fallback?.dateOfBirth ?? null,
    placeOfBirth: normalizePlace(keyPerson?.placeOfBirth) ?? normalizePlace(fallback?.placeOfBirth),
  }
}

export function appendBirthInfoLines(
  base: string,
  birthInfo: ResolvedBirthInfo,
  formatDate: (date: Date | null | undefined) => string,
) {
  const lines = [base]
  const dob = formatDate(birthInfo.dateOfBirth)
  if (dob) lines.push(`Date of birth: ${dob}`)
  if (birthInfo.placeOfBirth) lines.push(`Place of birth: ${birthInfo.placeOfBirth}`)
  return lines.join('\n')
}
