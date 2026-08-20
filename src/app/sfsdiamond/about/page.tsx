import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About SFS',
  description: 'SFS Technology Group — a global leader in memorial diamond creation headquartered in Hong Kong.',
  alternates: { canonical: '/sfsdiamond/about' },
}

export default function AboutPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative h-[60vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/sfsdiamond/company.jpg" alt="SFS Technology Group" fill sizes="100vw" className="object-cover" priority />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,8,5,0.9) 0%, rgba(10,8,5,0.35) 60%, transparent 100%)' }} />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 pb-16 w-full">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Hong Kong · Global Reach</p>
          <h1 className="text-4xl md:text-6xl font-bold" style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif' }}>
            About S.F.S.
          </h1>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Who We Are</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              SFS Technology Group
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
              <p>
                SFS Technology Group is a global leader in memorial diamond creation. Headquartered
                in Hong Kong, we specialise in transforming the carbon from human or pet remains
                into certified lab-grown diamonds using Chemical Vapor Deposition (CVD) technology.
              </p>
              <p>
                Unlike other providers, we are a <strong>heavy-asset company</strong>: we own and
                operate our own laboratory and CVD factory. This gives us complete, end-to-end
                quality control at every stage of production — from carbon extraction to final
                quality certification.
              </p>
              <p>
                We believe that <em>love never fades — it takes on a new form.</em> Through our
                innovative process, we offer families a way to keep their loved ones close, forever.
              </p>
            </div>
          </div>
          <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/3' }}>
            <Image src="/sfsdiamond/sfs-logo-alt.png" alt="SFS Diamond logo" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain p-10 bg-white" />
          </div>
        </div>
      </section>

      {/* ── Core values ── */}
      <section className="py-20" style={{ background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>What Guides Us</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              Our Core Values
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: '◈', title: 'Precision',     desc: 'Every diamond is grown with scientific rigour. Each atom is placed with purpose, producing a stone of exceptional purity.' },
              { icon: '◎', title: 'Transparency',  desc: 'We provide a unique traceability code for every diamond, linking the final gemstone to the original remains with full accountability.' },
              { icon: '✦', title: 'Compassion',    desc: 'We treat every commission as a sacred commitment. Our team approaches each family\'s grief with patience, warmth, and respect.' },
            ].map(v => (
              <div
                key={v.title}
                className="rounded-2xl p-8 flex flex-col gap-4"
                style={{ background: '#1C1A16', border: '1px solid #2A2418' }}
              >
                <span className="text-3xl" style={{ color: '#C9A96E' }}>{v.icon}</span>
                <h3 className="font-semibold text-lg" style={{ color: '#F5F0E8' }}>{v.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#7A6A58' }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Two brands ── */}
      <section className="py-24" style={{ background: '#F2EDE3' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Our Group</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              SFS Technology Group Brands
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="rounded-2xl p-8" style={{ background: '#FFFFFF', border: '1px solid #EDE7D8', boxShadow: '0 1px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Human Memorial</p>
              <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>SFS Diamond</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
                Our flagship brand creates memorial diamonds from the cremated ashes or hair of
                deceased loved ones, using CVD technology and our signature Eternity Cut.
              </p>
            </div>
            <div className="rounded-2xl p-8" style={{ background: '#FFFFFF', border: '1px solid #EDE7D8', boxShadow: '0 1px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Pet Memorial</p>
              <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>Gempets</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
                Gempets extends our technology to pet companions. Families can honour the memory of
                beloved animals with the same certified CVD diamond process.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-start">
          <div>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Get in Touch</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-8" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Visit Us or<br />Send a Message
            </h2>
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: '#C9A96E' }}>Address</p>
                <p className="text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
                  No. 7, 20/F Boss Commercial Centre<br />
                  28 Ferry Street, Yau Ma Tei<br />
                  Kowloon, Hong Kong
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: '#C9A96E' }}>Phone</p>
                <a href="tel:+85265600073" className="text-sm hover:opacity-70 transition-opacity" style={{ color: '#1A1A1A' }}>
                  (852) 6560 0073
                </a>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: '#C9A96E' }}>Email</p>
                <a href="mailto:patricklau@sfsdiamonds.com" className="text-sm hover:opacity-70 transition-opacity" style={{ color: '#1A1A1A' }}>
                  patricklau@sfsdiamonds.com
                </a>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: '#C9A96E' }}>Social</p>
                <a
                  href="https://www.facebook.com/profile.php?id=61575282825230"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
                  style={{ color: '#1A1A1A' }}
                >
                  <Image src="/sfsdiamond/facebook.png" alt="Facebook" width={18} height={18} />
                  Facebook
                </a>
              </div>
            </div>
          </div>

          {/* Map placeholder + CTA */}
          <div className="flex flex-col gap-6">
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: '#111111', minHeight: 200 }}
            >
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Yau Ma Tei, Kowloon</p>
              <p className="text-2xl mb-2" style={{ color: '#F5F0E8' }}>📍</p>
              <p className="text-sm" style={{ color: '#7A6A58' }}>
                Boss Commercial Centre<br />28 Ferry Street
              </p>
              <a
                href="https://maps.google.com/?q=Boss+Commercial+Centre+28+Ferry+Street+Yau+Ma+Tei+Hong+Kong"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-xs underline"
                style={{ color: '#C9A96E' }}
              >
                Open in Google Maps →
              </a>
            </div>
            <div className="rounded-2xl p-8" style={{ background: '#F2EDE3' }}>
              <h3 className="font-semibold text-base mb-3" style={{ color: '#1A1A1A' }}>Start Your Memorial Diamond</h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#4A3E30' }}>
                Ready to begin? Our team will walk you through every step at your own pace.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href="/sfsdiamond/memorial-diamonds"
                  className="px-6 py-3 rounded-full font-medium text-sm text-center transition-all hover:opacity-90"
                  style={{ background: '#1A1A1A', color: '#F5F0E8' }}
                >
                  View Our Diamonds
                </Link>
                <Link
                  href="/sfsdiamond/qa"
                  className="px-6 py-3 rounded-full font-medium text-sm text-center border transition-all hover:bg-black/5"
                  style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
                >
                  Read FAQ
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
