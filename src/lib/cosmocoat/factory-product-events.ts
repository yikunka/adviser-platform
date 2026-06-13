export const FACTORY_PRODUCT_CHANGED = 'cosmocoat:factory-product-changed'

const BROADCAST_CHANNEL_NAME = 'cosmocoat:factory-product-changed'

export type FactoryProductChangedDetail = {
  productId: string
}

export function notifyFactoryProductChanged(productId: string) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<FactoryProductChangedDetail>(FACTORY_PRODUCT_CHANGED, {
      detail: { productId },
    }),
  )

  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channel.postMessage({ productId } satisfies FactoryProductChangedDetail)
    channel.close()
  } catch {
    // BroadcastChannel unavailable in some environments
  }
}

export function subscribeFactoryProductChanged(
  listener: (detail: FactoryProductChangedDetail) => void,
) {
  if (typeof window === 'undefined') return () => undefined

  const handleWindowEvent = (event: Event) => {
    listener((event as CustomEvent<FactoryProductChangedDetail>).detail)
  }

  window.addEventListener(FACTORY_PRODUCT_CHANGED, handleWindowEvent)

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<FactoryProductChangedDetail>) => {
      listener(event.data)
    }
  } catch {
    // BroadcastChannel unavailable in some environments
  }

  return () => {
    window.removeEventListener(FACTORY_PRODUCT_CHANGED, handleWindowEvent)
    channel?.close()
  }
}
