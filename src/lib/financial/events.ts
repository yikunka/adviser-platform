export const FINANCIAL_ACCOUNTS_CHANGED = 'adviser:financial-accounts-changed'

export type FinancialAccountsChangedDetail = {
  companyId: string
}

export function notifyFinancialAccountsChanged(companyId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<FinancialAccountsChangedDetail>(FINANCIAL_ACCOUNTS_CHANGED, {
      detail: { companyId },
    }),
  )
}
