import { describe, expect, it } from 'vitest'
import { applyTemplatePlaceholders, ENTITY_GROUP_TEMPLATES } from '@/lib/entity-groups/templates'

describe('entity group templates', () => {
  it('includes common multi-company structures', () => {
    const ids = ENTITY_GROUP_TEMPLATES.map(t => t.id)
    expect(ids).toContain('hk-holding-subs')
    expect(ids).toContain('offshore-hk-stack')
  })

  it('substitutes group name into placeholders', () => {
    const tpl = ENTITY_GROUP_TEMPLATES.find(t => t.id === 'single-hk')!
    const applied = applyTemplatePlaceholders(tpl, 'Sunrise')
    expect(applied.slots[0].placeholderNameEn).toBe('Sunrise Limited')
  })
})
