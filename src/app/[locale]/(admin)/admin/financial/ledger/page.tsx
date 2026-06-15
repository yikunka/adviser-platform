import { FinancialRouteRedirect } from '@/components/admin/financial/FinancialRouteRedirect'

/** Redirect to the URL-based route. Menu links point here; actual page lives at [companyId]/ledger. */
export default function FinancialLedgerRedirect() {
  return <FinancialRouteRedirect section="ledger" />
}
