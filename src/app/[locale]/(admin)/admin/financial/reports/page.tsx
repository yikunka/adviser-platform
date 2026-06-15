import { FinancialRouteRedirect } from '@/components/admin/financial/FinancialRouteRedirect'

/** Redirect to the URL-based route. Menu links point here; actual page lives at [companyId]/reports. */
export default function FinancialReportsRedirect() {
  return <FinancialRouteRedirect section="reports" />
}
