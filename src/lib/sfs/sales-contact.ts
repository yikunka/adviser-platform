/** Public SFS sales / brand contact — single source for site, chat, and emails. */

export const SFS_PUBLIC_WEBSITE = 'https://sfsdiamonds.com'
export const SFS_PUBLIC_WEBSITE_HOST = 'www.sfsdiamonds.com'

export const SFS_SALES_PHONE_DISPLAY = '+86 19129444364 (phone / WhatsApp)'
export const SFS_SALES_PHONE_E164 = '+8619129444364'
export const SFS_SALES_TEL_HREF = `tel:${SFS_SALES_PHONE_E164}`
export const SFS_SALES_WHATSAPP_HREF = `https://wa.me/8619129444364`

/** Partner sales inbox (live mailbox). */
export const SFS_SALES_EMAIL = 'patricklau@sfsdiamonds.com'
/** Primary public CTA — OEM / white-label enquiry. */
export const SFS_SALES_MAILTO_OEM =
  `mailto:${SFS_SALES_EMAIL}?subject=SFS%20OEM%20%2F%20White-label%20Enquiry`
/** @deprecated Prefer SFS_SALES_MAILTO_OEM for public site CTAs. */
export const SFS_SALES_MAILTO_PARTNERSHIP = SFS_SALES_MAILTO_OEM
export const SFS_SALES_MAILTO_APPROVAL =
  `mailto:${SFS_SALES_EMAIL}?subject=SFS%20Account%20Approval`

/** Company issuer inbox used on invoices / formal correspondence. */
export const SFS_ISSUER_EMAIL = 'info@sfsdiamond.com'

export const SFS_SALES_CONTACT_LINE =
  `${SFS_SALES_PHONE_DISPLAY} · ${SFS_SALES_EMAIL}`
