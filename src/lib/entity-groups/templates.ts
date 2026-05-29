export type EntityGroupTemplateSlot = {
  label: string
  companyType?: 'HONG_KONG' | 'BVI' | 'CAYMAN' | 'MARSHALL'
  placeholderNameEn: string
}

export type EntityGroupTemplate = {
  id: string
  name: string
  description: string
  slots: EntityGroupTemplateSlot[]
}

/** Predefined multi-company structures for common client setups. */
export const ENTITY_GROUP_TEMPLATES: EntityGroupTemplate[] = [
  {
    id: 'hk-holding-subs',
    name: 'HK Holding + Subsidiaries',
    description: 'One Hong Kong holding company with one or more operating subsidiaries.',
    slots: [
      { label: 'Holding', companyType: 'HONG_KONG', placeholderNameEn: '{group} Holdings Limited' },
      { label: 'Operating HK', companyType: 'HONG_KONG', placeholderNameEn: '{group} (HK) Limited' },
    ],
  },
  {
    id: 'offshore-hk-stack',
    name: 'Offshore + HK Stack',
    description: 'BVI/Cayman top entity with a Hong Kong operating company.',
    slots: [
      { label: 'Offshore', companyType: 'BVI', placeholderNameEn: '{group} Limited' },
      { label: 'HK OpCo', companyType: 'HONG_KONG', placeholderNameEn: '{group} (Hong Kong) Limited' },
    ],
  },
  {
    id: 'single-hk',
    name: 'Single HK Company',
    description: 'One Hong Kong limited company under the client group.',
    slots: [
      { label: 'Primary', companyType: 'HONG_KONG', placeholderNameEn: '{group} Limited' },
    ],
  },
]

export function applyTemplatePlaceholders(template: EntityGroupTemplate, groupName: string) {
  const safe = groupName.trim() || 'Client'
  return {
    ...template,
    slots: template.slots.map(slot => ({
      ...slot,
      placeholderNameEn: slot.placeholderNameEn.replace(/\{group\}/g, safe),
    })),
  }
}
