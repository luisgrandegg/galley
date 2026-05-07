import { describe, expect, it } from 'vitest'
import {
  validateLayout,
  checkContainment,
  checkOverlap,
  checkWallAdjacency,
  checkFixedPointAlignment,
  checkDoorSwingClear,
  checkWalkwayClearance,
  checkWorkTriangle,
  checkApplianceFrontClearance,
} from './validator.js'
import type { FixedPoint, Module, ValidatorInput, Wall } from './types.js'

// A 4 m × 3 m rectangular room. Walls form a closed polygon CCW.
//
//  (0,0) ──────────── (4000,0)
//    │                    │
//    │                    │
//  (0,3000) ───────── (4000,3000)
const ROOM_WALLS: Wall[] = [
  { id: 'w1', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 100 },
  { id: 'w2', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, thickness: 100 },
  { id: 'w3', start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 }, thickness: 100 },
  { id: 'w4', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, thickness: 100 },
]

function mkModule(o: Partial<Module> & { id: string; kind: Module['kind'] }): Module {
  return {
    position: { x: 100, y: 100 },
    rotation: 0,
    width: 600,
    depth: 600,
    height: 850,
    ...o,
  }
}

function baseInput(overrides: Partial<ValidatorInput> = {}): ValidatorInput {
  return {
    walls: ROOM_WALLS,
    fixedPoints: [],
    modules: [],
    hobType: 'induction',
    ...overrides,
  }
}

// ── 1. Containment ─────────────────────────────────────────────────────────

describe('checkContainment', () => {
  it('passes for a module fully inside the room', () => {
    const v = checkContainment(
      baseInput({
        modules: [mkModule({ id: 'm1', kind: 'base_cabinet', position: { x: 100, y: 100 } })],
      })
    )
    expect(v).toHaveLength(0)
  })

  it('flags a module sticking out of the room', () => {
    const v = checkContainment(
      baseInput({
        modules: [
          mkModule({
            id: 'out',
            kind: 'base_cabinet',
            position: { x: 3800, y: 100 }, // x+w = 4400 > 4000
          }),
        ],
      })
    )
    expect(v).toHaveLength(1)
    expect(v[0]!.kind).toBe('containment')
  })
})

// ── 2. Overlap ─────────────────────────────────────────────────────────────

describe('checkOverlap', () => {
  it('passes when modules touch but do not overlap interiors', () => {
    const v = checkOverlap(
      baseInput({
        modules: [
          mkModule({ id: 'a', kind: 'base_cabinet', position: { x: 100, y: 100 } }),
          mkModule({ id: 'b', kind: 'base_cabinet', position: { x: 700, y: 100 } }),
        ],
      })
    )
    expect(v).toHaveLength(0)
  })

  it('flags overlapping modules', () => {
    const v = checkOverlap(
      baseInput({
        modules: [
          mkModule({ id: 'a', kind: 'base_cabinet', position: { x: 100, y: 100 } }),
          mkModule({ id: 'b', kind: 'base_cabinet', position: { x: 400, y: 100 } }),
        ],
      })
    )
    expect(v).toHaveLength(1)
    expect(v[0]!.kind).toBe('overlap')
    expect(v[0]!.moduleIds).toEqual(['a', 'b'])
  })
})

// ── 3. Wall adjacency ──────────────────────────────────────────────────────

describe('checkWallAdjacency', () => {
  it('passes for a base cabinet against the top wall', () => {
    const v = checkWallAdjacency(
      baseInput({
        modules: [mkModule({ id: 'm', kind: 'base_cabinet', position: { x: 200, y: 0 } })],
      })
    )
    expect(v).toHaveLength(0)
  })

  it('flags a base cabinet floating in the middle of the room', () => {
    const v = checkWallAdjacency(
      baseInput({
        modules: [
          mkModule({ id: 'mid', kind: 'base_cabinet', position: { x: 1500, y: 1200 } }),
        ],
      })
    )
    expect(v).toHaveLength(1)
    expect(v[0]!.kind).toBe('wall_adjacency')
  })

  it('does not flag islands away from walls', () => {
    const v = checkWallAdjacency(
      baseInput({
        modules: [
          mkModule({
            id: 'isl',
            kind: 'island',
            position: { x: 1500, y: 1100 },
            width: 1500,
            depth: 900,
          }),
        ],
      })
    )
    expect(v).toHaveLength(0)
  })
})

// ── 4. Fixed-point alignment ───────────────────────────────────────────────

describe('checkFixedPointAlignment', () => {
  const water: FixedPoint = { id: 'w', kind: 'water', position: { x: 1000, y: 100 } }
  const drain: FixedPoint = { id: 'd', kind: 'drain', position: { x: 1100, y: 100 } }
  const electric: FixedPoint = { id: 'e', kind: 'electric', position: { x: 2000, y: 100 } }

  it('passes when the sink is near both water and drain', () => {
    const v = checkFixedPointAlignment(
      baseInput({
        fixedPoints: [water, drain],
        modules: [mkModule({ id: 'sink', kind: 'sink_unit', position: { x: 700, y: 0 } })],
      })
    )
    expect(v).toHaveLength(0)
  })

  it('flags a sink placed far from water', () => {
    const v = checkFixedPointAlignment(
      baseInput({
        fixedPoints: [water, drain],
        modules: [mkModule({ id: 'sink', kind: 'sink_unit', position: { x: 3000, y: 0 } })],
      })
    )
    expect(v.some((x) => x.kind === 'fixed_point_alignment')).toBe(true)
  })

  it('flags a fridge with no nearby electric point', () => {
    const v = checkFixedPointAlignment(
      baseInput({
        fixedPoints: [electric],
        modules: [
          mkModule({
            id: 'f',
            kind: 'fridge',
            position: { x: 100, y: 0 },
            width: 600,
            depth: 650,
          }),
        ],
      })
    )
    expect(v.some((x) => x.kind === 'fixed_point_alignment')).toBe(true)
  })

  it('respects hobType: gas hob requires a gas inlet', () => {
    const gas: FixedPoint = { id: 'g', kind: 'gas', position: { x: 2000, y: 100 } }
    const v = checkFixedPointAlignment(
      baseInput({
        hobType: 'gas',
        fixedPoints: [gas],
        modules: [mkModule({ id: 'h', kind: 'hob_unit', position: { x: 1700, y: 0 } })],
      })
    )
    expect(v).toHaveLength(0)
  })
})

// ── 5. Door swing clear ────────────────────────────────────────────────────

describe('checkDoorSwingClear', () => {
  const door: FixedPoint = {
    id: 'door',
    kind: 'door',
    position: { x: 500, y: 3000 },
    width: 800,
    swing: 'left',
  }

  it('passes when no module is in the swing arc', () => {
    const v = checkDoorSwingClear(
      baseInput({
        fixedPoints: [door],
        modules: [
          mkModule({ id: 'far', kind: 'base_cabinet', position: { x: 3000, y: 0 } }),
        ],
      })
    )
    expect(v).toHaveLength(0)
  })

  it('flags a module placed inside the door swing arc', () => {
    const v = checkDoorSwingClear(
      baseInput({
        fixedPoints: [door],
        modules: [
          mkModule({
            id: 'block',
            kind: 'base_cabinet',
            position: { x: 200, y: 2400 },
          }),
        ],
      })
    )
    expect(v).toHaveLength(1)
    expect(v[0]!.kind).toBe('door_swing_blocked')
  })
})

// ── 6. Walkway clearance ──────────────────────────────────────────────────

describe('checkWalkwayClearance', () => {
  it('passes when opposing runs are ≥ 900 mm apart', () => {
    const v = checkWalkwayClearance(
      baseInput({
        modules: [
          mkModule({ id: 'top', kind: 'base_cabinet', position: { x: 1000, y: 0 } }),
          mkModule({
            id: 'bot',
            kind: 'base_cabinet',
            position: { x: 1000, y: 1600 },
            rotation: 180,
          }),
        ],
      })
    )
    expect(v).toHaveLength(0)
  })

  it('flags opposing runs with a < 900 mm walkway', () => {
    const v = checkWalkwayClearance(
      baseInput({
        modules: [
          mkModule({ id: 'top', kind: 'base_cabinet', position: { x: 1000, y: 0 } }),
          mkModule({
            id: 'bot',
            kind: 'base_cabinet',
            position: { x: 1000, y: 1200 },
            rotation: 180,
          }),
        ],
      })
    )
    expect(v).toHaveLength(1)
    expect(v[0]!.kind).toBe('walkway_clearance')
  })

  it('does not flag side-by-side modules on the same wall (same orientation)', () => {
    const v = checkWalkwayClearance(
      baseInput({
        modules: [
          mkModule({ id: 'a', kind: 'base_cabinet', position: { x: 0, y: 0 } }),
          mkModule({ id: 'b', kind: 'base_cabinet', position: { x: 700, y: 0 } }),
        ],
      })
    )
    expect(v).toHaveLength(0)
  })
})

// ── 7. Work triangle ──────────────────────────────────────────────────────

describe('checkWorkTriangle', () => {
  function triangleInput(positions: { sink: number; hob: number; fridge: number }) {
    return baseInput({
      modules: [
        mkModule({ id: 's', kind: 'sink_unit', position: { x: positions.sink, y: 0 } }),
        mkModule({ id: 'h', kind: 'hob_unit', position: { x: positions.hob, y: 0 } }),
        mkModule({
          id: 'f',
          kind: 'fridge',
          position: { x: positions.fridge, y: 0 },
          width: 600,
          depth: 650,
        }),
      ],
    })
  }

  it('passes for a healthy triangle', () => {
    // All three appliances along the top wall, evenly spaced — legs of 1200 mm
    // each, perimeter 2400 mm. Comfortably within the WORK_TRIANGLE limits.
    const input = baseInput({
      modules: [
        mkModule({ id: 's', kind: 'sink_unit', position: { x: 300, y: 0 } }),
        mkModule({ id: 'h', kind: 'hob_unit', position: { x: 1500, y: 0 } }),
        mkModule({
          id: 'f',
          kind: 'fridge',
          position: { x: 2700, y: 0 },
          width: 600,
          depth: 650,
        }),
      ],
    })
    const v = checkWorkTriangle(input)
    expect(v).toHaveLength(0)
  })

  it('flags a triangle with a too-short leg', () => {
    const v = checkWorkTriangle(triangleInput({ sink: 0, hob: 700, fridge: 1500 }))
    expect(v.some((x) => x.kind === 'work_triangle')).toBe(true)
  })

  it('returns no violations when fewer than 3 of the appliances exist', () => {
    const v = checkWorkTriangle(
      baseInput({
        modules: [mkModule({ id: 's', kind: 'sink_unit', position: { x: 200, y: 0 } })],
      })
    )
    expect(v).toHaveLength(0)
  })
})

// ── 8. Appliance front clearance ──────────────────────────────────────────

describe('checkApplianceFrontClearance', () => {
  it('passes when nothing blocks the front', () => {
    const v = checkApplianceFrontClearance(
      baseInput({
        modules: [
          mkModule({
            id: 'fridge',
            kind: 'fridge',
            position: { x: 100, y: 0 },
            width: 600,
            depth: 650,
          }),
        ],
      })
    )
    expect(v).toHaveLength(0)
  })

  it('flags a module placed in front of a fridge', () => {
    const v = checkApplianceFrontClearance(
      baseInput({
        modules: [
          mkModule({
            id: 'fridge',
            kind: 'fridge',
            position: { x: 100, y: 0 },
            width: 600,
            depth: 650,
          }),
          mkModule({
            id: 'block',
            kind: 'base_cabinet',
            position: { x: 100, y: 700 },
          }),
        ],
      })
    )
    expect(v).toHaveLength(1)
    expect(v[0]!.kind).toBe('appliance_front_clearance')
  })
})

// ── End-to-end ─────────────────────────────────────────────────────────────

describe('validateLayout (end-to-end)', () => {
  it('returns ok: true when every check passes', () => {
    // Sink, hob, fridge all along the top wall — backed against the wall, near
    // their service points, no opposing parallel runs, no doors.
    const input = baseInput({
      fixedPoints: [
        { id: 'w', kind: 'water', position: { x: 600, y: 100 } },
        { id: 'd', kind: 'drain', position: { x: 700, y: 100 } },
        { id: 'e1', kind: 'electric', position: { x: 1800, y: 100 } },
        { id: 'e2', kind: 'electric', position: { x: 3000, y: 100 } },
      ],
      modules: [
        mkModule({ id: 's', kind: 'sink_unit', position: { x: 300, y: 0 } }),
        mkModule({ id: 'h', kind: 'hob_unit', position: { x: 1500, y: 0 } }),
        mkModule({
          id: 'f',
          kind: 'fridge',
          position: { x: 2700, y: 0 },
          width: 600,
          depth: 650,
        }),
      ],
    })
    const result = validateLayout(input)
    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('aggregates violations from every check (never short-circuits)', () => {
    // Two overlapping modules placed far from any wall and with no electric points.
    const input = baseInput({
      modules: [
        mkModule({ id: 'a', kind: 'fridge', position: { x: 1500, y: 1200 } }),
        mkModule({ id: 'b', kind: 'fridge', position: { x: 1700, y: 1200 } }),
      ],
    })
    const result = validateLayout(input)
    expect(result.ok).toBe(false)
    // Expect overlap, wall adjacency, fixed-point alignment violations at minimum.
    const kinds = new Set(result.violations.map((v) => v.kind))
    expect(kinds.has('overlap')).toBe(true)
    expect(kinds.has('wall_adjacency')).toBe(true)
    expect(kinds.has('fixed_point_alignment')).toBe(true)
  })
})
