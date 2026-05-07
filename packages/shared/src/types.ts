// All units in millimetres. All coordinates in the room's local frame:
// origin at top-left of the bounding box of the traced walls; +x right, +y down.
// See ADR-002.

export type Vec2 = { x: number; y: number }

export type Wall = {
  id: string
  start: Vec2
  end: Vec2
  /** mm — default 100 */
  thickness: number
}

export type FixedPointKind =
  | 'water'
  | 'drain'
  | 'gas'
  | 'electric'
  | 'door'
  | 'window'

export type FixedPoint = {
  id: string
  kind: FixedPointKind
  position: Vec2
  /** mm — door/window only */
  width?: number
  /** door only */
  swing?: 'left' | 'right' | 'none'
}

export type Preferences = {
  style: 'modern' | 'classic' | 'rustic' | 'minimal' | 'industrial'
  budgetTier: 'low' | 'mid' | 'high'
  cookingFrequency: 'rare' | 'weekly' | 'daily' | 'intense'
  hobType: 'induction' | 'gas' | 'ceramic'
  ovenType: 'single' | 'double' | 'combi' | 'none'
  fridgeSize: 'compact' | 'standard' | 'american'
  dishwasher: boolean
  islandPreferred: boolean
  /** 0 if no island or no seating */
  seatingAtIsland: number
  storagePriority: 'low' | 'medium' | 'high'
  /** free-form tags, e.g. "wheelchair", "low-shelves" */
  accessibility: string[]
  /** free text */
  notes: string
}

export type ModuleKind =
  | 'base_cabinet'
  | 'wall_cabinet'
  | 'tall_cabinet'
  | 'sink_unit'
  | 'hob_unit'
  | 'oven_tower'
  | 'fridge'
  | 'dishwasher'
  | 'island'

export type Module = {
  id: string
  kind: ModuleKind
  /** mm — top-left of footprint before rotation */
  position: Vec2
  rotation: 0 | 90 | 180 | 270
  /** mm — along x before rotation */
  width: number
  /** mm — along y before rotation */
  depth: number
  /** mm — informational */
  height: number
  label?: string
}

export type Layout = {
  modules: Module[]
  generatedAt: string
  rationale: string
}

export type Project = {
  id: string
  name: string
  createdAt: string
  blueprint: { filename: string; widthPx: number; heightPx: number } | null
  scale: { pxPerMm: number } | null
  walls: Wall[]
  fixedPoints: FixedPoint[]
  preferences: Preferences | null
  layout: Layout | null
}

// ── Validator output ─────────────────────────────────────────────────────────

export type ViolationKind =
  | 'containment'
  | 'overlap'
  | 'wall_adjacency'
  | 'fixed_point_alignment'
  | 'door_swing_blocked'
  | 'walkway_clearance'
  | 'work_triangle'
  | 'appliance_front_clearance'

export type Violation = {
  kind: ViolationKind
  message: string
  moduleIds: string[]
}

export type ValidatorInput = {
  walls: Wall[]
  fixedPoints: FixedPoint[]
  modules: Module[]
  /** must mirror the user's hob choice; the LLM should pass it through from preferences */
  hobType: Preferences['hobType']
}

export type ValidatorResult = {
  ok: boolean
  violations: Violation[]
}
