import Image from 'next/image'

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="theme-dark min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(ellipse at top, #1a1510 0%, #0C0C0C 55%)' }}
    >
      <div className="mb-10 flex flex-col items-center gap-8 w-full max-w-3xl">
        <p
          className="text-[10px] tracking-[0.25em] uppercase text-center"
          style={{ color: '#5A5040' }}
        >
          Multi-brand admin
        </p>
        <div className="flex flex-wrap items-center justify-center gap-10 md:gap-14">
          <div className="flex flex-col items-center gap-2">
            <Image src="/logo.png" alt="6M Advise" width={52} height={52} className="object-contain" />
            <Image
              src="/logo_text.avif"
              alt="6M Advise"
              width={140}
              height={34}
              className="object-contain"
              style={{ filter: 'brightness(1.08)' }}
            />
          </div>
          <Image
            src="/sfsdiamond/sfs-logo-dark.png"
            alt="SFS Diamond"
            width={160}
            height={48}
            className="object-contain max-h-12 w-auto"
          />
          <Image
            src="/cosmocoat/logo.png"
            alt="CosmoCoat"
            width={160}
            height={44}
            className="object-contain max-h-11 w-auto"
            style={{ filter: 'drop-shadow(0 0 8px rgba(255,34,0,0.35))' }}
          />
        </div>
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-10 text-xs text-center" style={{ color: '#3A3020' }}>
        © {new Date().getFullYear()} 6AM Advisory Limited
      </p>
    </div>
  )
}
