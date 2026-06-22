import { type SfsDiamondSpecCategory } from '@prisma/client'

export type SfsSpecOption = {
  id: string
  category: SfsDiamondSpecCategory
  label: string
  value: string
  imageUrl: string | null
  sortOrder: number
  isActive: boolean
}

export type SfsOrderSpecOptions = {
  colors: SfsSpecOption[]
  carats: SfsSpecOption[]
  shapes: SfsSpecOption[]
  settingTypes: SfsSpecOption[]
  ringDesigns: SfsSpecOption[]
  necklaceDesigns: SfsSpecOption[]
  earringDesigns: SfsSpecOption[]
  braceletDesigns: SfsSpecOption[]
  metals: SfsSpecOption[]
}

export const SFS_SPEC_CATEGORIES = [
  'COLOR',
  'CARAT',
  'SHAPE',
  'SETTING_TYPE',
  'RING_DESIGN',
  'NECKLACE_DESIGN',
  'EARRING_DESIGN',
  'BRACELET_DESIGN',
  'METAL',
] as const satisfies readonly SfsDiamondSpecCategory[]

export const SFS_SPEC_CATEGORY_LABELS: Record<SfsDiamondSpecCategory, string> = {
  COLOR: 'Color',
  CARAT: 'Carat',
  SHAPE: 'Shape',
  SETTING_TYPE: 'Setting Type',
  RING_DESIGN: 'Ring Design',
  NECKLACE_DESIGN: 'Necklace Design',
  EARRING_DESIGN: 'Earring Design',
  BRACELET_DESIGN: 'Bracelet Design',
  METAL: 'Metal',
}

export const SFS_DESIGN_IMAGE_CATEGORIES = new Set<SfsDiamondSpecCategory>([
  'COLOR',
  'SHAPE',
  'RING_DESIGN',
  'NECKLACE_DESIGN',
  'EARRING_DESIGN',
  'BRACELET_DESIGN',
])

const DEFAULT_SPEC_OPTIONS: SfsSpecOption[] = [
  option('COLOR', 'Natural Color', null, 10),
  option('COLOR', 'Transparent', null, 20),

  option('CARAT', '0.5', null, 10),
  option('CARAT', '1.0', null, 20),
  option('CARAT', '1.5', null, 30),
  option('CARAT', '2.0', null, 40),
  option('CARAT', '2.5', null, 50),
  option('CARAT', '3.0', null, 60),

  option('SHAPE', 'Round', '/sfsdiamond/order/cut-round.jpeg', 10),
  option('SHAPE', 'Oval', '/sfsdiamond/order/cut-oval.jpeg', 20),
  option('SHAPE', 'Heart', '/sfsdiamond/order/cut-heart.jpeg', 30),
  option('SHAPE', 'Octagon', '/sfsdiamond/order/cut-octagon.jpeg', 40),
  option('SHAPE', 'Cushion Square', '/sfsdiamond/order/cut-cushion.jpeg', 50),
  option('SHAPE', 'Princess', '/sfsdiamond/order/cut-princess.png', 60),
  option('SHAPE', 'Emerald', '/sfsdiamond/order/cut-Emerald.png', 70),

  option('SETTING_TYPE', 'Ring', null, 10),
  option('SETTING_TYPE', 'Necklace', null, 20),
  option('SETTING_TYPE', 'Earring', null, 25),
  option('SETTING_TYPE', 'Bracelet', null, 30),
  option('SETTING_TYPE', 'Diamond only', null, 40),

  option('RING_DESIGN', 'Solitaire', '/sfsdiamond/order/ring-solitaire.png', 10),
  option('RING_DESIGN', 'Pave', '/sfsdiamond/order/ring-pave.png', 20),
  option('RING_DESIGN', 'Halo', '/sfsdiamond/order/ring-halo.png', 30),
  option('RING_DESIGN', 'R Classic', '/sfsdiamond/order/ring-R-Classic.jpg', 40),

  option('NECKLACE_DESIGN', 'Classic', '/sfsdiamond/order/necklace-classic.jpeg', 10),
  option('NECKLACE_DESIGN', 'Plain', '/sfsdiamond/order/necklace-plain.jpeg', 20),
  option('NECKLACE_DESIGN', 'Buddha', '/sfsdiamond/order/necklace-buddha.jpeg', 30),
  option('NECKLACE_DESIGN', 'Cross', '/sfsdiamond/order/necklace-cross.jpeg', 40),
  option('NECKLACE_DESIGN', 'Yinyang', '/sfsdiamond/order/necklace-yinyang.jpeg', 50),

  option('EARRING_DESIGN', 'Stud', null, 10),
  option('EARRING_DESIGN', 'Drop', null, 20),
  option('EARRING_DESIGN', 'Hoop', null, 30),

  option('BRACELET_DESIGN', 'Classic', '/sfsdiamond/order/necklace-classic.jpeg', 10),
  option('BRACELET_DESIGN', 'Plain', '/sfsdiamond/order/necklace-plain.jpeg', 20),
  option('BRACELET_DESIGN', 'Tennis', null, 30),
  option('BRACELET_DESIGN', 'Chain', null, 40),

  option('METAL', 'Platinum', null, 10),
  option('METAL', 'Yellow Gold', null, 20),
  option('METAL', 'Rose Gold', null, 30),
  option('METAL', 'White Gold', null, 40),
]

function option(
  category: SfsDiamondSpecCategory,
  label: string,
  imageUrl: string | null,
  sortOrder: number,
): SfsSpecOption {
  return {
    id: `default-${category.toLowerCase()}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    category,
    label,
    value: label,
    imageUrl,
    sortOrder,
    isActive: true,
  }
}

export function groupSfsSpecOptions(options: SfsSpecOption[]): SfsOrderSpecOptions {
  const byCategory = new Map<SfsDiamondSpecCategory, SfsSpecOption[]>()
  for (const category of SFS_SPEC_CATEGORIES) byCategory.set(category, [])
  for (const item of options) {
    byCategory.get(item.category)?.push(item)
  }

  return {
    colors: byCategory.get('COLOR') ?? [],
    carats: byCategory.get('CARAT') ?? [],
    shapes: byCategory.get('SHAPE') ?? [],
    settingTypes: byCategory.get('SETTING_TYPE') ?? [],
    ringDesigns: byCategory.get('RING_DESIGN') ?? [],
    necklaceDesigns: byCategory.get('NECKLACE_DESIGN') ?? [],
    earringDesigns: byCategory.get('EARRING_DESIGN') ?? [],
    braceletDesigns: byCategory.get('BRACELET_DESIGN') ?? [],
    metals: byCategory.get('METAL') ?? [],
  }
}

export function getDesignOptionsForSettingType(
  settingType: string,
  options: SfsOrderSpecOptions,
): SfsSpecOption[] {
  return getDesignOptionGroupsForSettingType(settingType, options).flatMap(group => group.options)
}

export function getDesignOptionGroupsForSettingType(
  settingType: string,
  options: SfsOrderSpecOptions,
): Array<{ label: string; options: SfsSpecOption[] }> {
  switch (settingType) {
    case 'Ring':
      return [{ label: 'Ring Design', options: options.ringDesigns }]
    case 'Necklace':
      return [{ label: 'Necklace Design', options: options.necklaceDesigns }]
    case 'Earring':
      return [
        { label: 'Earring Design', options: options.earringDesigns },
        { label: 'Bracelet Design', options: options.braceletDesigns },
      ].filter(group => group.options.length > 0)
    case 'Bracelet':
      return [{ label: 'Bracelet Design', options: options.braceletDesigns }]
    default:
      return []
  }
}

export function getDefaultSfsOrderSpecOptions(): SfsOrderSpecOptions {
  return groupSfsSpecOptions(DEFAULT_SPEC_OPTIONS)
}
