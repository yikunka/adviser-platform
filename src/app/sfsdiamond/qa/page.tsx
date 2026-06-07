'use client'

import { useState } from 'react'
import Link from 'next/link'

const FAQS = [
  {
    q: 'How much bone ash or hair is needed?',
    a: 'To create one memorial diamond, we typically require 60 grams of bone ashes or 1 gram of hair. Both materials can be combined if you wish to use a blend.',
  },
  {
    q: 'Do you use all the ashes provided?',
    a: 'Only a portion of the ashes is needed for diamond creation. Any unused remains can be returned to you or scattered according to your wishes — whatever is most meaningful to your family.',
  },
  {
    q: 'How do I prepare and send the ashes?',
    a: 'We will provide you with a secure collection box. You may deliver the materials directly to our office in Yau Ma Tei, Hong Kong, or send them via our verified courier service.',
  },
  {
    q: 'What if I don\'t have enough bone ashes?',
    a: 'If the quantity is insufficient, you can supplement with hair, or we can extract carbon from personal belongings of the deceased — such as clothing, stuffed toys, shoes, or books.',
  },
  {
    q: 'Are memorial diamonds real diamonds?',
    a: 'Yes. Memorial diamonds created by SFS possess the same physical, chemical, and optical properties as natural diamonds. They are graded and certified by the internationally recognised 4C standards — Colour, Clarity, Cut, and Carat Weight.',
  },
  {
    q: 'How long does production take?',
    a: 'The complete production process — from carbon extraction to final polishing and delivery — takes approximately two to three months on average.',
  },
  {
    q: 'Why do memorial diamonds have different colours?',
    a: 'CVD-grown memorial diamonds typically show shades of yellow. The variation from light to deep yellow depends on the nitrogen content present in the carbon source. We do not artificially alter the colour — the hue reflects the natural composition of your loved one\'s remains.',
  },
  {
    q: 'Why choose SFS Technology?',
    a: 'SFS is a heavy-asset company — we own and operate our own laboratory and CVD factory. This means we maintain complete quality control at every stage. We offer full traceability (each stone has a unique ID linked to the original remains), rigorous 4C certification, and a team that treats every commission as a sacred responsibility.',
  },
  {
    q: 'Can I also use pet remains?',
    a: 'Yes. Our sister brand Gempets specialises in memorial diamonds created from pet remains. The same CVD process and quality standards apply. Please contact us for details.',
  },
  {
    q: 'What is CVD technology?',
    a: 'Chemical Vapor Deposition (CVD) grows diamonds by introducing carbon-rich gas into a vacuum chamber and activating it with microwave plasma. Carbon atoms are deposited layer by layer onto a diamond seed, forming a real crystalline diamond. It is the most advanced and pure method available — and it requires no metal catalysts, unlike HPHT.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{ background: '#FFFFFF', border: '1px solid #EDE7D8' }}
    >
      <button
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{q}</span>
        <span
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-transform duration-200"
          style={{ background: open ? '#1A1A1A' : '#F2EDE3', transform: open ? 'rotate(45deg)' : 'none' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke={open ? '#C9A96E' : '#6B5E4A'} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-6 pb-5">
          <div className="h-px mb-4" style={{ background: '#EDE7D8' }} />
          <p className="text-sm leading-relaxed" style={{ color: '#4A3E30' }}>{a}</p>
        </div>
      )}
    </div>
  )
}

export default function QAPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="py-24 text-center" style={{ background: '#111111' }}>
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>Your Questions Answered</p>
          <h1 className="text-4xl md:text-5xl font-bold" style={{ color: '#F5F0E8', fontFamily: 'Georgia, serif' }}>
            Frequently Asked<br />Questions
          </h1>
          <p className="mt-6 text-sm leading-relaxed" style={{ color: '#7A6A58' }}>
            Everything you need to know about memorial diamonds, the CVD process,
            and what to expect when you choose SFS.
          </p>
        </div>
      </section>

      {/* ── FAQ list ── */}
      <section className="py-20" style={{ background: '#FAFAF8' }}>
        <div className="max-w-3xl mx-auto px-6 flex flex-col gap-3">
          {FAQS.map(({ q, a }) => (
            <FAQItem key={q} q={q} a={a} />
          ))}
        </div>
      </section>

      {/* ── Still have questions ── */}
      <section className="py-20 text-center" style={{ background: '#F2EDE3' }}>
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
            Still Have Questions?
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#4A3E30' }}>
            Our team is here to guide you through every step. Reach out — there are no rushed
            conversations when it comes to honouring someone you love.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="tel:+85265600073"
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#1A1A1A', color: '#F5F0E8' }}
            >
              Call (852) 6560 0073
            </a>
            <a
              href="mailto:kenny@sfsdiamonds.com"
              className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-black/5"
              style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
            >
              kenny@sfsdiamonds.com
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
