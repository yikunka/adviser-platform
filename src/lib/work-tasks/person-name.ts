/** Document order for a natural person: surname, then given names. Companies keep their registered name. */
export function naturalPersonNameSurnameFirst(person: {
  firstName?: string | null
  lastName?: string | null
  otherName?: string | null
  nameEn?: string | null
}): string {
  const last = person.lastName?.trim() ?? ''
  const first = person.firstName?.trim() ?? ''
  const other = person.otherName?.trim() ?? ''
  const ordered = [last, first, other].filter(Boolean).join(' ')
  return ordered || person.nameEn?.trim() || ''
}
