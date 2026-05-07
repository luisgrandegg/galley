import type { Module, Vec2, Wall } from './types.js'

/** A module's axis-aligned footprint in mm. Rotation by 90/270 swaps w/d. */
export type Rect = { x: number; y: number; w: number; h: number }

export function moduleFootprint(m: Module): Rect {
  const swap = m.rotation === 90 || m.rotation === 270
  return {
    x: m.position.x,
    y: m.position.y,
    w: swap ? m.depth : m.width,
    h: swap ? m.width : m.depth,
  }
}

export function rectCorners(r: Rect): [Vec2, Vec2, Vec2, Vec2] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ]
}

export function rectCenter(r: Rect): Vec2 {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** Strict overlap (touching edges OK, overlapping interiors not). */
export function rectsOverlap(a: Rect, b: Rect, eps = 0.001): boolean {
  return (
    a.x + a.w > b.x + eps &&
    b.x + b.w > a.x + eps &&
    a.y + a.h > b.y + eps &&
    b.y + b.h > a.y + eps
  )
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Shortest distance from a point to a segment. */
export function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return distance(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy })
}

/** Shortest distance between two segments (each segment shrinks to a point if zero-length). */
export function segmentSegmentDistance(
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2
): number {
  if (segmentsIntersect(a1, a2, b1, b2)) return 0
  return Math.min(
    pointSegmentDistance(a1, b1, b2),
    pointSegmentDistance(a2, b1, b2),
    pointSegmentDistance(b1, a1, a2),
    pointSegmentDistance(b2, a1, a2)
  )
}

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

export function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  return false
}

/**
 * Point-in-polygon by ray casting against an unordered list of wall segments
 * that collectively form a simple closed polygon. Cast a horizontal ray to +∞
 * and count crossings.
 */
export function pointInWalls(p: Vec2, walls: Wall[]): boolean {
  let crossings = 0
  for (const w of walls) {
    const a = w.start
    const b = w.end
    if (a.y === b.y) continue // horizontal edge — skip (boundary case)
    const yMin = Math.min(a.y, b.y)
    const yMax = Math.max(a.y, b.y)
    if (p.y <= yMin || p.y > yMax) continue
    const t = (p.y - a.y) / (b.y - a.y)
    const xCross = a.x + t * (b.x - a.x)
    if (xCross > p.x) crossings++
  }
  return crossings % 2 === 1
}

export function rectBoundingBox(walls: Wall[]): Rect {
  if (walls.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  let xMin = Infinity
  let yMin = Infinity
  let xMax = -Infinity
  let yMax = -Infinity
  for (const w of walls) {
    for (const p of [w.start, w.end]) {
      if (p.x < xMin) xMin = p.x
      if (p.y < yMin) yMin = p.y
      if (p.x > xMax) xMax = p.x
      if (p.y > yMax) yMax = p.y
    }
  }
  return { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin }
}

/**
 * Min distance from a rectangle's perimeter to any wall segment. We use this
 * for wall-adjacency: if any side of the rect is within `threshold` mm of a
 * wall, the module is considered backed against that wall.
 */
export function rectToWallsMinDistance(r: Rect, walls: Wall[]): number {
  const corners = rectCorners(r)
  const sides: [Vec2, Vec2][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ]
  let min = Infinity
  for (const [s1, s2] of sides) {
    for (const w of walls) {
      const d = segmentSegmentDistance(s1, s2, w.start, w.end)
      if (d < min) min = d
    }
  }
  return min
}
