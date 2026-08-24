import { FinancialRouteRedirect } from '@/components/admin/financial/FinancialRouteRedirect'

/** Redirect to the URL-based route. Menu links point here; actual page lives at [companyId]/settings. */
export default function FinancialSettingsRedirect() {
  return <FinancialRouteRedirect section="settings" />
}
