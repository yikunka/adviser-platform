import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="theme-dark min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: '#0C0C0C' }}
    >
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <Image
          src="/logo.png"
          alt=""
          width={52}
          height={52}
          style={{ objectFit: 'contain' }}
        />
        <Image
          src="/logo_text.avif"
          alt="6AM Advisory"
          width={180}
          height={40}
          style={{ objectFit: 'contain', filter: 'brightness(1.08)' }}
        />
        <p className="text-xs tracking-widest uppercase" style={{ color: '#4A4030', letterSpacing: '0.22em' }}>
          Client Portal
        </p>
      </div>

      {/* Card area */}
      <div className="w-full max-w-md">{children}</div>

      {/* Footer */}
      <p className="mt-10 text-xs" style={{ color: '#3A3020' }}>
        © {new Date().getFullYear()} 6AM Advisory Limited. All rights reserved.
      </p>
    </div>
  )
}
