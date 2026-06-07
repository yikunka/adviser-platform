export const SFS_PREDEFINED_STEPS: Record<string, string[]> = {
  CHEM_TRANSFORM: [
    'Package Received',
    'Check Sample & Labeling',
    'Observe Sample Status & Check Weigh',
    'Rinse & Clean',
    'Drying with Oven',
    'Transform to dust',
    'Grinding',
    'Check Status',
    'Chemical Transformation from dust to gas bag',
    'Double Check Label of gas dust bag & gas bottle',
    'Transfer sample from gas bag to gas bottle',
  ],
  CVD: [
    'Gas bottle to connect with CVD machine',
    '1st Check Status (Day 0)',
    '2nd Check Status (Day 7)',
    '3rd Check Status (Day 14)',
    '4th Check Status (Day 21)',
    'Labeling',
  ],
  CRAFTING: [
    'Crafting Start',
    'Crafting End',
    'Certification',
    'Packaging',
  ],
}

export const SFS_PHASE_LABELS: Record<string, string> = {
  CHEM_TRANSFORM: 'Chemical Transformation',
  CVD: 'CVD Growth',
  CRAFTING: 'Crafting & Jewelry Setting',
}

export const SFS_PHASE_ORDER = ['CHEM_TRANSFORM', 'CVD', 'CRAFTING'] as const

export const SFS_TOTAL_PREDEFINED_STEPS = Object.values(SFS_PREDEFINED_STEPS).reduce(
  (sum, steps) => sum + steps.length,
  0,
)

/** 0-based index of the weight-entry step in CHEM_TRANSFORM */
export function sfsChemTransformWeightStepIndex() {
  return 2
}

/** 0-based index of the single-photo CVD step */
export function sfsCvdSinglePhotoStepIndex() {
  return 4
}
