'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type Props = {
  children: React.ReactNode
  /** Homepage uses full hero + section reveals; inner pages use page-hero only. */
  variant?: 'home' | 'page'
  className?: string
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Restrained GSAP motion for the TCSP / 6AM public marketing site.
 * Selectors: .public-hero-* (entrance), .public-reveal / .public-reveal-item (scroll).
 */
export default function PublicGsapMotion({ children, variant = 'page', className }: Props) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!root.current || prefersReducedMotion()) return

      const isMobile = window.matchMedia('(max-width: 768px)').matches
      const yHero = isMobile ? 24 : 36
      const yReveal = isMobile ? 28 : 40
      const duration = isMobile ? 0.65 : 0.85
      const stagger = isMobile ? 0.08 : 0.12

      const heroBits = root.current.querySelectorAll(
        '.public-hero-brand, .public-hero-title, .public-hero-sub, .public-hero-ctas, .public-hero-meta',
      )
      if (heroBits.length) {
        // CSS starts these at opacity: 0 — animate into place.
        gsap.set(heroBits, { y: yHero })
        gsap.to(heroBits, {
          y: 0,
          opacity: 1,
          duration,
          stagger,
          ease: 'power3.out',
          clearProps: 'transform',
        })
      }

      const heroMedia = root.current.querySelector('.public-hero-media')
      if (heroMedia && variant === 'home') {
        gsap.fromTo(
          heroMedia,
          { scale: 1.04 },
          { scale: 1, duration: 1.6, ease: 'power2.out' },
        )
      }

      root.current.querySelectorAll<HTMLElement>('.public-reveal').forEach(section => {
        const items = section.querySelectorAll('.public-reveal-item')
        const targets = items.length > 0 ? items : [section]
        gsap.from(targets, {
          scrollTrigger: {
            trigger: section,
            start: 'top 82%',
            once: true,
          },
          y: yReveal,
          opacity: 0,
          duration: isMobile ? 0.55 : 0.7,
          stagger: items.length > 1 ? (isMobile ? 0.08 : 0.1) : 0,
          ease: 'power2.out',
          clearProps: 'transform',
        })
      })
    },
    { scope: root, dependencies: [variant] },
  )

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  )
}
