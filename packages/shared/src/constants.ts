import type { ModuleKind } from './types.js'

// European 60 cm modular system. Source of truth for both the validator and
// the LLM. Pass these constants in the system prompt verbatim — see ADR-005.

export const STANDARD_MODULES: Record<
  ModuleKind,
  { widths: number[]; depth: number; height: number }
> = {
  base_cabinet: { widths: [400, 500, 600, 800, 1000, 1200], depth: 600, height: 850 },
  wall_cabinet: { widths: [400, 500, 600, 800, 1000], depth: 350, height: 720 },
  tall_cabinet: { widths: [600], depth: 600, height: 2100 },
  sink_unit: { widths: [600, 800, 1000], depth: 600, height: 850 },
  hob_unit: { widths: [600, 800, 900], depth: 600, height: 850 },
  oven_tower: { widths: [600], depth: 600, height: 2100 },
  fridge: { widths: [600, 700, 900], depth: 650, height: 1850 },
  dishwasher: { widths: [450, 600], depth: 600, height: 850 },
  island: { widths: [1200, 1500, 1800, 2400], depth: 900, height: 900 },
}

export const CLEARANCES = {
  /** mm minimum free space between opposing surfaces */
  walkway: 900,
  /** mm clear arc in front of a door */
  doorSwing: 800,
  /** mm in front of fridge/oven/dishwasher when open */
  applianceFront: 1100,
} as const

export const WORK_TRIANGLE = {
  minLegMm: 1200,
  maxLegMm: 2700,
  maxPerimeterMm: 7900,
} as const

/** Modules that must back against a wall (island excluded). */
export const WALL_BACKED_KINDS: ModuleKind[] = [
  'base_cabinet',
  'wall_cabinet',
  'tall_cabinet',
  'sink_unit',
  'hob_unit',
  'oven_tower',
  'fridge',
  'dishwasher',
]

/** Modules whose front needs swing/open clearance. */
export const APPLIANCE_FRONT_KINDS: ModuleKind[] = ['fridge', 'oven_tower', 'dishwasher']

/** Default thickness for traced walls, mm. */
export const DEFAULT_WALL_THICKNESS = 100

/** Snap threshold for "near a wall", mm. */
export const WALL_ADJACENCY_THRESHOLD = 50

/** Snap threshold for sink/hob/fridge near a fixed point, mm. */
export const FIXED_POINT_THRESHOLD = 600
