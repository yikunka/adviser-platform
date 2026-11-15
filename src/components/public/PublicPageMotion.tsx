'use client'

import PublicGsapMotion from '@/components/public/PublicGsapMotion'

/** Client wrapper so server pages can opt into TCSP public GSAP motion. */
export default function PublicPageMotion({ children }: { children: React.ReactNode }) {
  return <PublicGsapMotion variant="page">{children}</PublicGsapMotion>
}
