type FinancialCompanyLike = {
  id: string
}

export function resolveStoredFinancialCompanyId(
  companies: readonly FinancialCompanyLike[],
  storedCompanyId: string | null | undefined,
) {
  if (!storedCompanyId) return ''
  return companies.some(company => company.id === storedCompanyId) ? storedCompanyId : ''
}
