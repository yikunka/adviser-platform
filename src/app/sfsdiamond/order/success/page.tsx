import Link from 'next/link'

export default async function SFSOrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-24 text-center"
      style={{ background: '#FAFAF8' }}
    >
      <div className="max-w-lg">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl"
          style={{ background: '#FDF8F0' }}
        >
          ✦
        </div>
        <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: '#C9A96E' }}>
          Order Received
        </p>
        <h1
          className="text-3xl md:text-4xl font-bold mb-5"
          style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}
        >
          Thank You for Your Trust
        </h1>

        {code && (
          <div
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl mb-6 mx-auto"
            style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)' }}
          >
            <span className="text-xs uppercase tracking-widest" style={{ color: '#9A7A50' }}>
              Sample Code
            </span>
            <span
              className="text-lg font-mono font-bold tracking-widest"
              style={{ color: '#C9A96E' }}
            >
              {code}
            </span>
          </div>
        )}

        <p className="text-sm leading-relaxed mb-8" style={{ color: '#6B5E4A' }}>
          Your order has been submitted successfully. The SFS team will prepare your personalised
          quotation and reach out as soon as possible. When ashes or hair are transformed into
          sparkling diamonds, they become another form of love&apos;s existence.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/sfsdiamond/dashboard"
            className="inline-block px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
            style={{ background: '#1A1A1A', color: '#F5F0E8' }}
          >
            View My Orders
          </Link>
          <Link
            href="/sfsdiamond"
            className="inline-block px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
            style={{ background: 'transparent', color: '#6B5E4A', border: '1px solid #EDE7D8' }}
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
