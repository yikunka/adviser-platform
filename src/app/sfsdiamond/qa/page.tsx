'use client'

import { useState } from 'react'
import Link from 'next/link'

const PARTNER_FAQS = [
  {
    q: 'Who can place an order?',
    a: 'Approved distributor accounts. The public site is not a consumer checkout. Apply with your company, market, and expected volume. Staff approve the account before order details and the order form open.',
  },
  {
    q: 'How long does production take?',
    a: 'About two to three months from carbon extraction to delivery. Plan your client promise around that lead time.',
  },
  {
    q: 'What material do you need?',
    a: 'Typically 60 grams of bone ash or 1 gram of hair per diamond. Both can be combined. If ash is short, hair or carbon from personal belongings can supplement it.',
  },
  {
    q: 'What should I tell a client about colour?',
    a: 'CVD memorial diamonds usually show shades of yellow. The range follows nitrogen in the carbon source. We do not artificially change the colour. Say that before the client expects a colourless stone.',
  },
  {
    q: 'What certificate comes with the stone?',
    a: 'Sales follow the actual item and the official IGI certificate specifications, not the website photographs. Stones are graded on the 4C standards: colour, clarity, cut, and carat weight.',
  },
  {
    q: 'What happens to unused remains?',
    a: 'Only a portion is used. Unused remains can be returned or handled as the family asks. Confirm that instruction with your client before intake.',
  },
  {
    q: 'Can the programme include pets?',
    a: 'Yes. Gempets is the pet line on the same CVD process. Ask us if that market is part of your agreement.',
  },
]

const CLIENT_FAQS = [
  {
    q: 'How much bone ash or hair is needed?',
    a: 'To create one memorial diamond, we typically require 60 grams of bone ashes or 1 gram of hair. Both materials can be combined.',
  },
  {
    q: 'Are memorial diamonds real diamonds?',
    a: 'Yes. They have the same physical, chemical, and optical properties as natural diamonds, and they are graded on the 4C standards.',
  },
  {
    q: 'Why do the colours differ?',
    a: 'The yellow range comes from nitrogen in the carbon source. The colour is not artificially altered.',
  },
  {
    q: 'What is CVD technology?',
    a: 'Chemical Vapor Deposition grows a diamond from carbon-rich gas in a vacuum chamber, activated by microwave plasma. Carbon deposits layer by layer on a diamond seed. No metal catalyst is required.',
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
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A96E' }}>For partners</p>
          <h1 className="text-4xl md:text-5xl font-bold" style={{ color: '#F5F0E8', fontFamily: 'Georgia, serif' }}>
            What distributors<br />need to know
          </h1>
          <p className="mt-6 text-sm leading-relaxed" style={{ color: '#7A6A58' }}>
            Lead time, materials, colour, and certificates — the facts you use with your own clients.
          </p>
        </div>
      </section>

      {/* ── FAQ list ── */}
      <section className="py-20" style={{ background: '#FAFAF8' }}>
        <div className="max-w-3xl mx-auto px-6 flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm uppercase tracking-widest" style={{ color: '#C9A96E' }}>Partner questions</h2>
            {PARTNER_FAQS.map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-sm uppercase tracking-widest" style={{ color: '#C9A96E' }}>Language you can give a client</h2>
            {CLIENT_FAQS.map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Still have questions ── */}
      <section className="py-20 text-center" style={{ background: '#F2EDE3' }}>
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}>
            Talk to the factory
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#4A3E30' }}>
            Distributor terms, packaging, and production tracking are agreed with our team.
            Families are served through your company, not through this website.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="tel:+8619129444364"
              className="px-8 py-3.5 rounded-full font-medium text-sm transition-all hover:opacity-90"
              style={{ background: '#1A1A1A', color: '#F5F0E8' }}
            >
              +86 19129444364 (phone / WhatsApp)
            </a>
            <a
              href="https://wa.me/8619129444364"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-black/5"
              style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
            >
              WhatsApp
            </a>
            <a
              href="mailto:patricklau@sfsdiamonds.com"
              className="px-8 py-3.5 rounded-full font-medium text-sm border transition-all hover:bg-black/5"
              style={{ border: '1px solid #C9A96E', color: '#1A1A1A' }}
            >
              patricklau@sfsdiamonds.com
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
