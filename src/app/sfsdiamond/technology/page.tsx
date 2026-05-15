import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Technology | SFS Diamond',
  description: 'How SFS Technology uses CVD — Chemical Vapor Deposition — to transform cremated ashes into real certified diamonds.',
}

const EXTRACTION_STEPS = [
  { num: '1.1', title: 'Labelling & Tracking',      desc: 'Each sample is assigned a unique identification code for full traceability throughout the process.',           img: '/sfsdiamond/process-1.jpg' },
  { num: '1.2', title: 'Grinding',                   desc: 'The ashes are milled to increase reaction surface area, enabling thorough chemical purification.',             img: '/sfsdiamond/process-2.jpg' },
  { num: '1.3', title: 'Chemical Purification',      desc: 'Calcium phosphate and other minerals are removed, isolating the pure carbon component.',                      img: '/sfsdiamond/extraction.jpg' },
  { num: '1.4', title: 'High-Temperature Treatment', desc: 'Purified carbon is treated in oxygen-free conditions to prevent oxidation and ensure maximum purity.',        img: '/sfsdiamond/chemical.jpg' },
  { num: '1.5', title: 'Vaporisation',               desc: 'The purified carbon is converted into gas form, ready to be fed into the CVD chamber.',                      img: '/sfsdiamond/carbon-source.webp' },
]

const CVD_STEPS = [
  { num: '2.1', title: 'Seed Preparation',       desc: 'A high-purity diamond seed crystal is placed inside a vacuum chamber.',                                             img: '/sfsdiamond/cvd-machine.jpeg' },
  { num: '2.2', title: 'Carbon Gas Introduction', desc: 'A precisely controlled mixture of carbon-rich gases is introduced at low pressure.',                              img: '/sfsdiamond/cvd-diagram.jpg' },
  { num: '2.3', title: 'Plasma Activation',       desc: 'High-energy microwave plasma breaks down the gas molecules, releasing carbon atoms.',                             img: '/sfsdiamond/growth.jpg' },
  { num: '2.4', title: 'Layer-by-Layer Growth',   desc: 'Carbon atoms settle onto the seed and arrange into a perfect crystalline lattice — an atom-thick layer at a time.', img: '/sfsdiamond/diamond-pure.jpg' },
  { num: '2.5', title: 'Controlled Duration',     desc: 'Growth continues for weeks to months depending on the desired carat weight and specifications.',                  img: '/sfsdiamond/craft-1.jpg' },
  { num: '2.6', title: 'Post-Growth Treatment',   desc: 'The raw diamond is cooled and extracted. It may show a brownish tint at this stage — normal for CVD stones.',     img: '/sfsdiamond/craft-2.jpg' },
]

const CRAFT_STEPS = [
  { num: '3.1', title: 'Marking',        desc: 'Expert craftsmen identify the optimal cutting areas using the diamond\'s internal structure.',   img: '/sfsdiamond/step-mark.jpg' },
  { num: '3.2', title: 'Scanning',       desc: 'High-precision 3D scanning technology maps the stone\'s internal composition in detail.',        img: '/sfsdiamond/step-scan.jpg' },
  { num: '3.3', title: 'Design',         desc: 'Cutting design balances weight retention, optical performance, and client preferences.',         img: '/sfsdiamond/step-design.jpg' },
  { num: '3.4', title: 'Laser Cut',      desc: 'High-energy laser technology ensures micron-level precision cuts without stress fractures.',     img: '/sfsdiamond/step-laser.jpg' },
  { num: '3.5', title: 'Polish',         desc: 'Preliminary shaping is followed by hand-polishing to smooth surfaces and reveal maximum fire.',  img: '/sfsdiamond/step-polish.jpg' },
  { num: '3.6', title: 'Quality Control','desc': 'Final grading by the 4Cs (Colour, Clarity, Cut, Carat) and certification before delivery.',   img: '/sfsdiamond/step-quality.jpg' },
]

function StepGrid({ steps }: { steps: typeof EXTRACTION_STEPS }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {steps.map(s => (
        <div
          key={s.num}
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #EDE7D8', boxShadow: '0 1px 12px rgba(0,0,0,0.04)' }}
        >
          <div className="relative h-44">
            <Image src={s.img} alt={s.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" />
            <div
              className="absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ background: '#C9A96E', color: '#0A0805' }}
            >
              {s.num}
            </div>
          </div>
          <div className="p-5">
            <h3 className="font-semibold text-sm mb-1.5" style={{ color: '#1A1A1A' }}>{s.title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: '#6B5E4A' }}>{s.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TechnologyPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative h-[55vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/sfsdiamond/cvd-machine.jpeg" alt="CVD Technology" fill sizes="100vw" className="object-cover" priority />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,8,5,0.9) 0%, rgba(10,8,5,0.4) 60%, transparent 100%)' }} />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 pb-16 w-full">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#C9A96E' }}>Chemical Vapor Deposition</p>
          <h1 className="text-4xl md:text-6xl font-bold" style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif' }}>
            Our Technology
          </h1>
        </div>
      </section>

      {/* ── Intro: Carbon ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>The Essence of Life</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Carbon — The Building<br />Block of All Life
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: '#4A3E30' }}>
              <p>
                Every living being is built on carbon. Bone ashes contain 3–9% carbon; hair contains
                45–50%. This carbon — the literal substance of a life once lived — is the raw
                material for your memorial diamond.
              </p>
              <p>
                Diamonds are the purest form of carbon. By extracting and purifying the carbon from
                your loved one's remains and growing it into a diamond crystal, we are not creating
                something artificial. We are revealing the most perfect form that carbon can take.
              </p>
            </div>
          </div>
          <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/3' }}>
            <Image src="/sfsdiamond/carbon-source.webp" alt="Carbon source" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </div>
        </div>
      </section>

      {/* ── CVD explanation ── */}
      <section className="py-20" style={{ background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/3' }}>
            <Image src="/sfsdiamond/cvd-diagram.jpg" alt="CVD diagram" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>The Process</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              Chemical Vapor<br />Deposition (CVD)
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: '#A89880' }}>
              <p>
                CVD is the most advanced method for growing diamonds. Inside a vacuum chamber, high-energy
                microwave plasma breaks down carbon-rich gas molecules. The freed carbon atoms then settle
                — one atomic layer at a time — onto a diamond seed crystal, building a perfect lattice.
              </p>
              <p>
                Unlike HPHT (High Pressure High Temperature), CVD requires no metal catalysts, produces
                naturally fewer inclusions, and gives us precise control over every parameter of the
                growing diamond.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {[
                ['No metal catalysts',     'HPHT requires iron/cobalt'],
                ['Fewer inclusions',       'Cleaner crystal growth'],
                ['Full customisation',     'Size & colour control'],
                ['Higher purity',          'Atom-by-atom precision'],
              ].map(([a, b]) => (
                <div key={a} className="rounded-xl p-4" style={{ background: '#1C1A16', border: '1px solid #2A2418' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#C9A96E' }}>{a}</p>
                  <p className="text-xs" style={{ color: '#7A6A58' }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Step 1: Extraction ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <span className="text-xs font-bold px-3 py-1 rounded-full mr-3" style={{ background: '#C9A96E', color: '#0A0805' }}>Step 1</span>
            <p className="text-xs uppercase tracking-widest inline" style={{ color: '#6B5E4A' }}>Carbon Extraction &amp; Purification</p>
            <h2 className="text-2xl md:text-3xl font-bold mt-4" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              From Remains to Pure Carbon
            </h2>
          </div>
          <StepGrid steps={EXTRACTION_STEPS} />
        </div>
      </section>

      {/* ── Step 2: CVD Growth ── */}
      <section className="py-24" style={{ background: '#F2EDE3' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <span className="text-xs font-bold px-3 py-1 rounded-full mr-3" style={{ background: '#C9A96E', color: '#0A0805' }}>Step 2</span>
            <p className="text-xs uppercase tracking-widest inline" style={{ color: '#6B5E4A' }}>CVD Diamond Growth Process</p>
            <h2 className="text-2xl md:text-3xl font-bold mt-4" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Growing the Diamond
            </h2>
          </div>
          <StepGrid steps={CVD_STEPS} />
        </div>
      </section>

      {/* ── Step 3: Crafting ── */}
      <section className="py-24" style={{ background: '#FAFAF8' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <span className="text-xs font-bold px-3 py-1 rounded-full mr-3" style={{ background: '#C9A96E', color: '#0A0805' }}>Step 3</span>
            <p className="text-xs uppercase tracking-widest inline" style={{ color: '#6B5E4A' }}>Crafting Workflow</p>
            <h2 className="text-2xl md:text-3xl font-bold mt-4" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
              Cutting &amp; Polishing
            </h2>
          </div>
          <StepGrid steps={CRAFT_STEPS} />
        </div>
      </section>

      {/* ── Quality assurance ── */}
      <section className="py-20" style={{ background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: '1/1', maxWidth: 440 }}>
            <Image src="/sfsdiamond/qc-diagram.png" alt="Quality Control" fill sizes="(max-width: 768px) 100vw, 440px" className="object-cover" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Guarantee</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif', color: '#F5F0E8' }}>
              Ensuring the Quality
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: '#A89880' }}>
              Every memorial diamond is graded by the internationally recognised 4C framework —
              Colour, Clarity, Cut, and Carat Weight — before delivery. Each stone is accompanied by
              a full quality certificate and a unique traceability code linked to the original remains.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {['Colour', 'Clarity', 'Cut', 'Carat Weight'].map(c => (
                <div key={c} className="rounded-xl p-4 text-center" style={{ background: '#1C1A16', border: '1px solid #2A2418' }}>
                  <p className="text-sm font-semibold" style={{ color: '#C9A96E' }}>{c}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 text-center" style={{ background: '#F2EDE3' }}>
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
            See the Diamonds We Create
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#4A3E30' }}>
            Discover our Eternity Cut memorial diamonds and jewellery settings.
          </p>
          <Link
            href="/sfsdiamond/memorial-diamonds"
            className="inline-block px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
            style={{ background: '#1A1A1A', color: '#F5F0E8' }}
          >
            View Memorial Diamonds
          </Link>
        </div>
      </section>
    </>
  )
}
