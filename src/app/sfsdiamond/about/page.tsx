import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About SFS',
  description: 'SFS Technology Group — a Hong Kong memorial-diamond manufacturer for professional distributors.',
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
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Hong Kong · Manufacturer</p>
          <h1 className="text-4xl md:text-6xl font-bold" style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif' }}>
            The company behind the factory
          </h1>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Who we supply</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              A factory partners can put their name beside
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
              <p>
                SFS Technology Group manufactures memorial diamonds in Hong Kong for professional
                distributors. We extract carbon from human or pet remains and grow certified
                lab-grown diamonds with Chemical Vapor Deposition (CVD).
              </p>
              <p>
                We are a <strong>heavy-asset company</strong>: we own and operate the laboratory
                and the CVD factory. Carbon extraction, growth, cutting, and certification stay
                inside one production system, so a partner is not buying from a trading desk.
              </p>
              <p>
                A partner receives the stone, the official certificate, packaging for client
                handover, and live production status. You keep the client relationship.
              </p>
              <p>
                <em>The story your client hears:</em> love never fades — it takes a new form.
                That line belongs in your sales conversation. The company behind it is a factory.
              </p>
            </div>
          </div>
          <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/3' }}>
            <Image
              src="/sfsdiamond/chemical.jpg"
              alt="SFS Technology Group CVD laboratory and factory"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
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
              { icon: '✦', title: 'Compassion',    desc: 'Every commission is handled with care. Your client should feel that respect; you should be able to explain the process without guessing.' },
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
                The human memorial line. Partners sell diamonds grown from cremated ashes or hair,
                cut in the Eternity form and delivered with certification.
              </p>
            </div>
            <div className="rounded-2xl p-8" style={{ background: '#FFFFFF', border: '1px solid #EDE7D8', boxShadow: '0 1px 12px rgba(0,0,0,0.04)' }}>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Pet Memorial</p>
              <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>Gempets</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
                The pet memorial line, on the same CVD process and quality standard, for partners
                whose market includes companion animals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-start">
          <div>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Partner desk</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-8" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Talk to the factory
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
                <a href="tel:+8619129444364" className="text-sm hover:opacity-70 transition-opacity" style={{ color: '#1A1A1A' }}>
                  +86 19129444364 (phone / WhatsApp)
                </a>
                <a
                  href="https://wa.me/8619129444364"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm mt-1 hover:opacity-70 transition-opacity"
                  style={{ color: '#1A1A1A' }}
                >
                  WhatsApp
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
              <h3 className="font-semibold text-base mb-3" style={{ color: '#1A1A1A' }}>Apply for a market</h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#4A3E30' }}>
                Tell us your company, the market you cover, and the volume you expect. We manufacture;
                you own the client relationship.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href="mailto:patricklau@sfsdiamonds.com?subject=SFS%20Distributor%20Partnership"
                  className="px-6 py-3 rounded-full font-medium text-sm text-center transition-all hover:opacity-90"
                  style={{ background: '#1A1A1A', color: '#F5F0E8' }}
                >
                  Become a distributor
                </a>
                <Link
                  href="/sfsdiamond/memorial-diamonds"
                  className="px-6 py-3 rounded-full font-medium text-sm text-center border transition-all hover:bg-black/5"
                  style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
                >
                  View the product programme
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
