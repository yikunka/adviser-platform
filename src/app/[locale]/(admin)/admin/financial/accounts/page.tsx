import { FinancialRouteRedirect } from '@/components/admin/financial/FinancialRouteRedirect'

/** Redirect to the URL-based route. Menu links point here; actual page lives at [companyId]/accounts. */
export default function FinancialAccountsRedirect() {
  return <FinancialRouteRedirect section="accounts" />
}
