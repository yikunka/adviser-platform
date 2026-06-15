const FINANCIAL_NAV_SECTIONS = new Set([
  'accounts', 'journal', 'ledger', 'reports',
  'receivables', 'payables', 'banking', 'parties',
])

type FinancialSection = 'selector' | 'accounts' | 'journal' | 'ledger' | 'reports' | 'receivables' | 'payables' | 'banking' | 'parties'

export function normalizeAdminPathname(pathname: string): string {
  const [pathOnly = '/'] = pathname.split(/[?#]/)
  const withoutLocale = pathOnly.replace(/^\/[^/]+(?=\/admin(?:\/|$))/, '')
  const withoutTrailingSlash = withoutLocale.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

export function financialRouteSection(pathname: string): FinancialSection | null {
  const segments = normalizeAdminPathname(pathname).split('/').filter(Boolean)
  const adminIndex = segments.indexOf('admin')
  if (adminIndex < 0 || segments[adminIndex + 1] !== 'financial') return null

  const financialSegments = segments.slice(adminIndex + 2)
  if (financialSegments.length === 0) return 'selector'

  const directSection = financialSegments[0]
  if (FINANCIAL_NAV_SECTIONS.has(directSection)) {
    return directSection as FinancialSection
  }

  const companyScopedSection = financialSegments[1]
  if (FINANCIAL_NAV_SECTIONS.has(companyScopedSection)) {
    return companyScopedSection as FinancialSection
  }

  return null
}

export function isAdminNavHrefActive(pathname: string, href: string): boolean {
  const normalizedPathname = normalizeAdminPathname(pathname)
  const normalizedHref = normalizeAdminPathname(href)
  const hrefFinancialSection = financialRouteSection(normalizedHref)

  if (hrefFinancialSection) {
    return financialRouteSection(normalizedPathname) === hrefFinancialSection
  }

  return normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)
}
