export const SFS_PREDEFINED_STEPS: Record<string, string[]> = {
  CHEM_TRANSFORM: [
    'Package Received',
    'Package arrived production site',
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
    'Diamond Seed Status',
    'Diamond Growth in CVD Machine',
    'Diamond Grown',
    'Check Finished Diamond Status and Labeling',
  ],
  CRAFTING: [
    'Crafting Start',
    'Crafting End',
    'Certification',
    'Packaging',
  ],
  JEWELRY_SETTING: [
    'Jewelry Setting Start',
    'Jewelry Setting End',
  ],
}

export const SFS_PHASE_LABELS: Record<string, string> = {
  CHEM_TRANSFORM: 'Chemical Transformation',
  CVD: 'CVD Growth',
  CRAFTING: 'Crafting',
  JEWELRY_SETTING: 'Jewelry Setting',
}

export const SFS_PHASE_ORDER = ['CHEM_TRANSFORM', 'CVD', 'CRAFTING', 'JEWELRY_SETTING'] as const

export const SFS_TOTAL_PREDEFINED_STEPS = Object.values(SFS_PREDEFINED_STEPS).reduce(
  (sum, steps) => sum + steps.length,
  0,
)

/** 0-based index of the weight-entry step in CHEM_TRANSFORM */
export function sfsChemTransformWeightStepIndex() {
  return 3
}

/** Default-key for CHEM_TRANSFORM weight step (1-based slot in predefined list). */
export const SFS_CHEM_WEIGHT_DEFAULT_KEY = 'CHEM_TRANSFORM:4'

/** Default-key for CVD final check / labeling (after removing Day-21 check). */
export const SFS_CVD_LABELING_DEFAULT_KEY = 'CVD:5'

/**
 * 0-based index of the CVD single-photo step in the *default* list.
 * Final CVD check/labeling uses per-diamond images instead; returns -1 so single-photo UI is unused for defaults.
 */
export function sfsCvdSinglePhotoStepIndex() {
  return -1
}

/** Build stable defaultKey for a predefined slot (1-based). */
export function sfsDefaultStepKey(phase: string, oneBasedIndex: number) {
  return `${phase}:${oneBasedIndex}`
}
