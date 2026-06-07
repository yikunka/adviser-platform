import Image from 'next/image'
import Link from 'next/link'

export default function SFSFooter() {
  return (
    <footer style={{ background: '#111111', color: '#A89880' }} className="mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Brand */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/sfsdiamond/logo.png"
              alt="SFS Diamond"
              width={32}
              height={32}
              quality={95}
              className="rounded-full object-cover"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <span className="font-semibold text-base" style={{ color: '#F5F0E8', fontFamily: 'Georgia, serif' }}>
              SFS Diamond
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#7A6A58' }}>
            Turning love into everlasting brilliance. Memorial diamonds crafted from cremated ashes
            using advanced CVD technology.
          </p>
          <a
            href="https://www.facebook.com/profile.php?id=61575282825230"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
            style={{ color: '#A89880' }}
          >
            <Image src="/sfsdiamond/facebook.png" alt="Facebook" width={20} height={20} />
            Follow us
          </a>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#C9A96E' }}>Pages</p>
          {[
            ['Home',              '/sfsdiamond'],
            ['Memorial Diamonds', '/sfsdiamond/memorial-diamonds'],
            ['Technology',        '/sfsdiamond/technology'],
            ['Q&A',               '/sfsdiamond/qa'],
            ['About SFS',         '/sfsdiamond/about'],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="text-sm hover:opacity-70 transition-opacity"
              style={{ color: '#A89880' }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#C9A96E' }}>Contact</p>
          <p className="text-sm leading-relaxed" style={{ color: '#7A6A58' }}>
            No. 7, 20F Boss Commercial Centre<br />
            28 Ferry St, Yau Ma Tei<br />
            Kowloon, Hong Kong
          </p>
          <a href="tel:+85265600073" className="text-sm hover:opacity-80" style={{ color: '#A89880' }}>
            (852) 6560 0073
          </a>
          <a href="mailto:kenny@sfsdiamonds.com" className="text-sm hover:opacity-80" style={{ color: '#A89880' }}>
            kenny@sfsdiamonds.com
          </a>
        </div>
      </div>

      <div className="border-t px-6 py-5 text-center text-xs" style={{ borderColor: '#2A2418', color: '#4A3E30' }}>
        © {new Date().getFullYear()} SFS Technology Group. All rights reserved.
      </div>
    </footer>
  )
}
