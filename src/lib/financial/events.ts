export const FINANCIAL_ACCOUNTS_CHANGED = 'adviser:financial-accounts-changed'

const BROADCAST_CHANNEL_NAME = 'adviser:financial-accounts-changed'

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

  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channel.postMessage({ companyId } satisfies FinancialAccountsChangedDetail)
    channel.close()
  } catch {
    // BroadcastChannel unavailable in some environments
  }
}

export function subscribeFinancialAccountsChanged(
  listener: (detail: FinancialAccountsChangedDetail) => void,
) {
  if (typeof window === 'undefined') return () => undefined

  const handleWindowEvent = (event: Event) => {
    listener((event as CustomEvent<FinancialAccountsChangedDetail>).detail)
  }

  window.addEventListener(FINANCIAL_ACCOUNTS_CHANGED, handleWindowEvent)

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<FinancialAccountsChangedDetail>) => {
      listener(event.data)
    }
  } catch {
    // BroadcastChannel unavailable in some environments
  }

  return () => {
    window.removeEventListener(FINANCIAL_ACCOUNTS_CHANGED, handleWindowEvent)
    channel?.close()
  }
}
