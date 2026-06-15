import { FinancialRouteRedirect } from '@/components/admin/financial/FinancialRouteRedirect'

/** Redirect to the URL-based route. Menu links point here; actual page lives at [companyId]/journal. */
export default function FinancialJournalRedirect() {
  return <FinancialRouteRedirect section="journal" />
}
