import Link from 'next/link'

export default function SFSOrderSuccessPage() {
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
        <p className="text-sm leading-relaxed mb-8" style={{ color: '#6B5E4A' }}>
          Your order has been submitted successfully. The SFS team will prepare your personalised
          quotation and reach out as soon as possible. When ashes or hair are transformed into
          sparkling diamonds, they become another form of love's existence.
        </p>
        <Link
          href="/sfsdiamond"
          className="inline-block px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
          style={{ background: '#1A1A1A', color: '#F5F0E8' }}
        >
          Return to Home
        </Link>
      </div>
    </div>
  )
}
