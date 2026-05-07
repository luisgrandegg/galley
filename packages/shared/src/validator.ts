import {
  APPLIANCE_FRONT_KINDS,
  CLEARANCES,
  FIXED_POINT_THRESHOLD,
  WALL_ADJACENCY_THRESHOLD,
  WALL_BACKED_KINDS,
  WORK_TRIANGLE,
} from './constants.js'
import {
  distance,
  moduleFootprint,
  pointInWalls,
  pointSegmentDistance,
  rectCenter,
  rectCorners,
  rectsOverlap,
  rectToWallsMinDistance,
} from './geometry.js'
import type {
  FixedPoint,
  Module,
  ValidatorInput,
  ValidatorResult,
  Violation,
} from './types.js'

/**
 * Deterministic layout validator. The source of truth for layout correctness.
 * See ADR-004.
 *
 * Runs every check independently and returns *all* violations — never short-
 * circuits. The LLM repair loop and the live UI both depend on full feedback.
 */
export function validateLayout(input: ValidatorInput): ValidatorResult {
  const violations: Violation[] = [
    ...checkContainment(input),
    ...checkOverlap(input),
    ...checkWallAdjacency(input),
    ...checkFixedPointAlignment(input),
    ...checkDoorSwingClear(input),
    ...checkWalkwayClearance(input),
    ...checkWorkTriangle(input),
    ...checkApplianceFrontClearance(input),
  ]
  return { ok: violations.length === 0, violations }
}

// 1. Containment ─────────────────────────────────────────────────────────────

export function checkContainment(input: ValidatorInput): Violation[] {
  const out: Violation[] = []
  for (const m of input.modules) {
    const r = moduleFootprint(m)
    // Test points 1 mm inside each corner. Modules backed flush against a wall
    // have a corner exactly on the boundary; ray-casting is ambiguous on the
    // boundary so we shrink slightly to land in the interior unambiguously.
    const inset = 1
    const probes = [
      { x: r.x + inset, y: r.y + inset },
      { x: r.x + r.w - inset, y: r.y + inset },
      { x: r.x + r.w - inset, y: r.y + r.h - inset },
      { x: r.x + inset, y: r.y + r.h - inset },
    ]
    const allInside = probes.every((c) => pointInWalls(c, input.walls))
    if (!allInside) {
      out.push({
        kind: 'containment',
        message: `Module ${labelOf(m)} (${m.id}) is not fully inside the wall polygon.`,
        moduleIds: [m.id],
      })
    }
  }
  return out
}

// 2. No overlap ──────────────────────────────────────────────────────────────

export function checkOverlap(input: ValidatorInput): Violation[] {
  const out: Violation[] = []
  const rects = input.modules.map((m) => ({ m, r: moduleFootprint(m) }))
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!
      const b = rects[j]!
      if (rectsOverlap(a.r, b.r)) {
        out.push({
          kind: 'overlap',
          message: `Modules ${labelOf(a.m)} (${a.m.id}) and ${labelOf(b.m)} (${b.m.id}) overlap.`,
          moduleIds: [a.m.id, b.m.id],
        })
      }
    }
  }
  return out
}

// 3. Wall adjacency ─────────────────────────────────────────────────────────

export function checkWallAdjacency(input: ValidatorInput): Violation[] {
  const out: Violation[] = []
  for (const m of input.modules) {
    if (!WALL_BACKED_KINDS.includes(m.kind)) continue
    const r = moduleFootprint(m)
    const d = rectToWallsMinDistance(r, input.walls)
    if (d > WALL_ADJACENCY_THRESHOLD) {
      out.push({
        kind: 'wall_adjacency',
        message: `Module ${labelOf(m)} (${m.id}) is ${Math.round(d)} mm from the nearest wall — must be within ${WALL_ADJACENCY_THRESHOLD} mm.`,
        moduleIds: [m.id],
      })
    }
  }
  return out
}

// 4. Fixed-point alignment ─────────────────────────────────────────────────

export function checkFixedPointAlignment(input: ValidatorInput): Violation[] {
  const out: Violation[] = []
  const water = input.fixedPoints.filter((p) => p.kind === 'water')
  const drain = input.fixedPoints.filter((p) => p.kind === 'drain')
  const gas = input.fixedPoints.filter((p) => p.kind === 'gas')
  const electric = input.fixedPoints.filter((p) => p.kind === 'electric')

  const sinks = input.modules.filter((m) => m.kind === 'sink_unit')
  const hobs = input.modules.filter((m) => m.kind === 'hob_unit')
  const fridges = input.modules.filter((m) => m.kind === 'fridge')
  const dishwashers = input.modules.filter((m) => m.kind === 'dishwasher')

  for (const m of sinks) {
    const c = rectCenter(moduleFootprint(m))
    if (!nearAny(c, water) || !nearAny(c, drain)) {
      out.push({
        kind: 'fixed_point_alignment',
        message: `Sink ${labelOf(m)} (${m.id}) is not within ${FIXED_POINT_THRESHOLD} mm of both a water inlet and a drain.`,
        moduleIds: [m.id],
      })
    }
  }

  const hobSource = input.hobType === 'gas' ? gas : electric
  for (const m of hobs) {
    const c = rectCenter(moduleFootprint(m))
    if (!nearAny(c, hobSource)) {
      out.push({
        kind: 'fixed_point_alignment',
        message: `Hob ${labelOf(m)} (${m.id}) is not within ${FIXED_POINT_THRESHOLD} mm of a${input.hobType === 'gas' ? ' gas inlet' : 'n electric point'}.`,
        moduleIds: [m.id],
      })
    }
  }

  for (const m of [...fridges, ...dishwashers]) {
    const c = rectCenter(moduleFootprint(m))
    if (!nearAny(c, electric)) {
      out.push({
        kind: 'fixed_point_alignment',
        message: `${m.kind === 'fridge' ? 'Fridge' : 'Dishwasher'} ${labelOf(m)} (${m.id}) is not within ${FIXED_POINT_THRESHOLD} mm of an electric point.`,
        moduleIds: [m.id],
      })
    }
  }

  return out
}

function nearAny(p: { x: number; y: number }, candidates: FixedPoint[]): boolean {
  return candidates.some((c) => distance(p, c.position) <= FIXED_POINT_THRESHOLD)
}

// 5. Door swing clear ───────────────────────────────────────────────────────

export function checkDoorSwingClear(input: ValidatorInput): Violation[] {
  const out: Violation[] = []
  const doors = input.fixedPoints.filter((p) => p.kind === 'door' && p.swing && p.swing !== 'none')
  for (const door of doors) {
    for (const m of input.modules) {
      const r = moduleFootprint(m)
      // Approximation: a module is in the swing arc if any of its corners or
      // sides is within CLEARANCES.doorSwing of the door anchor. Doors swing
      // an 800 mm radius; the exact arc shape (left vs right) is a refinement
      // we intentionally skip for MVP — we conservatively mark anything inside
      // the full circle as blocked.
      const corners = rectCorners(r)
      const inCircle = corners.some(
        (c) => distance(c, door.position) < CLEARANCES.doorSwing
      )
      const sideInCircle =
        pointSegmentDistance(door.position, corners[0]!, corners[1]!) < CLEARANCES.doorSwing ||
        pointSegmentDistance(door.position, corners[1]!, corners[2]!) < CLEARANCES.doorSwing ||
        pointSegmentDistance(door.position, corners[2]!, corners[3]!) < CLEARANCES.doorSwing ||
        pointSegmentDistance(door.position, corners[3]!, corners[0]!) < CLEARANCES.doorSwing
      if (inCircle || sideInCircle) {
        out.push({
          kind: 'door_swing_blocked',
          message: `Module ${labelOf(m)} (${m.id}) blocks the swing of door ${door.id}.`,
          moduleIds: [m.id],
        })
      }
    }
  }
  return out
}

// 6. Walkway clearance ──────────────────────────────────────────────────────

/**
 * Two cabinet runs that face each other across a gap need ≥ CLEARANCES.walkway mm
 * between them. We only flag pairs whose fronts actually point at each other
 * (per rotation) — modules sitting side-by-side on the same wall share an
 * orientation and don't form a walkway.
 *
 *   rotation 0   → front faces +y
 *   rotation 90  → front faces -x
 *   rotation 180 → front faces -y
 *   rotation 270 → front faces +x
 */
export function checkWalkwayClearance(input: ValidatorInput): Violation[] {
  const out: Violation[] = []
  const rects = input.modules
    .filter((m) => WALL_BACKED_KINDS.includes(m.kind) || m.kind === 'island')
    .map((m) => ({ m, r: moduleFootprint(m) }))

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!
      const b = rects[j]!
      const gap = facingGap(a, b)
      if (gap !== null && gap >= 0 && gap < CLEARANCES.walkway) {
        out.push({
          kind: 'walkway_clearance',
          message: `Walkway between ${labelOf(a.m)} (${a.m.id}) and ${labelOf(b.m)} (${b.m.id}) is ${Math.round(gap)} mm — must be at least ${CLEARANCES.walkway} mm.`,
          moduleIds: [a.m.id, b.m.id],
        })
      }
    }
  }
  return out
}

function facingGap(
  a: { m: Module; r: { x: number; y: number; w: number; h: number } },
  b: { m: Module; r: { x: number; y: number; w: number; h: number } }
): number | null {
  // a above b, a faces +y (down) and b faces -y (up): walkway is vertical.
  if (a.r.y + a.r.h <= b.r.y && a.m.rotation === 0 && b.m.rotation === 180) {
    if (overlap1D(a.r.x, a.r.w, b.r.x, b.r.w)) return b.r.y - (a.r.y + a.r.h)
  }
  if (b.r.y + b.r.h <= a.r.y && b.m.rotation === 0 && a.m.rotation === 180) {
    if (overlap1D(a.r.x, a.r.w, b.r.x, b.r.w)) return a.r.y - (b.r.y + b.r.h)
  }
  // a left of b, a faces +x (right) and b faces -x (left): walkway is horizontal.
  if (a.r.x + a.r.w <= b.r.x && a.m.rotation === 270 && b.m.rotation === 90) {
    if (overlap1D(a.r.y, a.r.h, b.r.y, b.r.h)) return b.r.x - (a.r.x + a.r.w)
  }
  if (b.r.x + b.r.w <= a.r.x && b.m.rotation === 270 && a.m.rotation === 90) {
    if (overlap1D(a.r.y, a.r.h, b.r.y, b.r.h)) return a.r.x - (b.r.x + b.r.w)
  }
  return null
}

function overlap1D(a: number, aLen: number, b: number, bLen: number): boolean {
  return a < b + bLen && b < a + aLen
}

// 7. Work triangle ──────────────────────────────────────────────────────────

export function checkWorkTriangle(input: ValidatorInput): Violation[] {
  const out: Violation[] = []
  const sink = input.modules.find((m) => m.kind === 'sink_unit')
  const hob = input.modules.find((m) => m.kind === 'hob_unit')
  const fridge = input.modules.find((m) => m.kind === 'fridge')
  if (!sink || !hob || !fridge) return out // triangle only meaningful when all 3 exist

  const cs = rectCenter(moduleFootprint(sink))
  const ch = rectCenter(moduleFootprint(hob))
  const cf = rectCenter(moduleFootprint(fridge))

  const legs: Array<{ a: Module; b: Module; d: number; label: string }> = [
    { a: sink, b: hob, d: distance(cs, ch), label: 'sink↔hob' },
    { a: hob, b: fridge, d: distance(ch, cf), label: 'hob↔fridge' },
    { a: fridge, b: sink, d: distance(cf, cs), label: 'fridge↔sink' },
  ]

  for (const leg of legs) {
    if (leg.d < WORK_TRIANGLE.minLegMm) {
      out.push({
        kind: 'work_triangle',
        message: `Work-triangle leg ${leg.label} is ${Math.round(leg.d)} mm — must be ≥ ${WORK_TRIANGLE.minLegMm} mm.`,
        moduleIds: [leg.a.id, leg.b.id],
      })
    }
    if (leg.d > WORK_TRIANGLE.maxLegMm) {
      out.push({
        kind: 'work_triangle',
        message: `Work-triangle leg ${leg.label} is ${Math.round(leg.d)} mm — must be ≤ ${WORK_TRIANGLE.maxLegMm} mm.`,
        moduleIds: [leg.a.id, leg.b.id],
      })
    }
  }

  const perimeter = legs.reduce((s, l) => s + l.d, 0)
  if (perimeter > WORK_TRIANGLE.maxPerimeterMm) {
    out.push({
      kind: 'work_triangle',
      message: `Work-triangle perimeter is ${Math.round(perimeter)} mm — must be ≤ ${WORK_TRIANGLE.maxPerimeterMm} mm.`,
      moduleIds: [sink.id, hob.id, fridge.id],
    })
  }

  return out
}

// 8. Appliance front clearance ─────────────────────────────────────────────

export function checkApplianceFrontClearance(input: ValidatorInput): Violation[] {
  const out: Violation[] = []
  const appliances = input.modules.filter((m) => APPLIANCE_FRONT_KINDS.includes(m.kind))
  const others = input.modules

  for (const m of appliances) {
    const r = moduleFootprint(m)
    // The "front" side is determined by rotation:
    //   0° → +y (down), 90° → -x (left), 180° → -y (up), 270° → +x (right).
    const frontRect = computeFrontClearanceRect(m, r)
    for (const other of others) {
      if (other.id === m.id) continue
      const or = moduleFootprint(other)
      if (rectsOverlapStrict(frontRect, or)) {
        out.push({
          kind: 'appliance_front_clearance',
          message: `Front of ${m.kind} ${labelOf(m)} (${m.id}) is blocked by ${labelOf(other)} (${other.id}); needs ${CLEARANCES.applianceFront} mm clear.`,
          moduleIds: [m.id, other.id],
        })
      }
    }
  }
  return out
}

function computeFrontClearanceRect(m: Module, r: { x: number; y: number; w: number; h: number }) {
  const c = CLEARANCES.applianceFront
  switch (m.rotation) {
    case 0:
      return { x: r.x, y: r.y + r.h, w: r.w, h: c }
    case 180:
      return { x: r.x, y: r.y - c, w: r.w, h: c }
    case 90:
      return { x: r.x - c, y: r.y, w: c, h: r.h }
    case 270:
      return { x: r.x + r.w, y: r.y, w: c, h: r.h }
  }
}

function rectsOverlapStrict(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, eps = 0.001): boolean {
  return (
    a.x + a.w > b.x + eps &&
    b.x + b.w > a.x + eps &&
    a.y + a.h > b.y + eps &&
    b.y + b.h > a.y + eps
  )
}

function labelOf(m: Module): string {
  return m.label ?? m.kind
}
