export type PartyCodeRole = 'customer' | 'supplier' | 'employee'

const PARTY_CODE_PREFIXES: Record<PartyCodeRole, string> = {
  customer: 'CL',
  supplier: 'SP',
  employee: 'ST',
}

export function resolvePartyCodeRole(args: {
  isCustomer?: boolean
  isSupplier?: boolean
  isEmployee?: boolean
}): PartyCodeRole | null {
  if (args.isCustomer) return 'customer'
  if (args.isSupplier) return 'supplier'
  if (args.isEmployee) return 'employee'
  return null
}

export function partyCodePrefixForRole(role: PartyCodeRole) {
  return PARTY_CODE_PREFIXES[role]
}

export function nextPartyCode(prefix: string, existingCodes: Iterable<string>) {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i')
  let maxSequence = 0

  for (const code of existingCodes) {
    const match = code.trim().match(pattern)
    if (!match) continue
    const sequence = Number.parseInt(match[1] ?? '', 10)
    if (Number.isFinite(sequence)) {
      maxSequence = Math.max(maxSequence, sequence)
    }
  }

  return `${prefix}-${String(maxSequence + 1).padStart(4, '0')}`
}

export function buildPartyCodePreview(args: {
  isCustomer?: boolean
  isSupplier?: boolean
  isEmployee?: boolean
}) {
  const role = resolvePartyCodeRole(args)
  if (!role) return '请选择至少一个角色'
  return `${partyCodePrefixForRole(role)}-XXXX`
}
