// Drag-snap helpers, in millimetres. Per ADR-002, all geometry is mm.
//
// We snap a module's axis-aligned bounding box to:
//   1. wall-segment edges within a 30 mm threshold, and then
//   2. other modules' edges within a 10 mm threshold.
//
// Walls and module edges are treated as axis-aligned for snapping purposes:
// each wall segment contributes a vertical line at min(start.x, end.x) /
// max(start.x, end.x) (when the segment has any vertical extent) and a
// horizontal line at min(start.y, end.y) / max(start.y, end.y) (when it has
// any horizontal extent). Diagonal walls thus only snap to their bounding
// extents, which is a good-enough approximation for an MVP since the spec
// expects mostly orthogonal kitchens.

import type { Vec2, Wall } from '@galley/shared'

export type SnapBox = { x: number; y: number; w: number; h: number }

export const WALL_SNAP_THRESHOLD = 30
export const MODULE_SNAP_THRESHOLD = 10

type Axis = 'x' | 'y'

function snapAxis(
  boxStart: number,
  boxLen: number,
  candidates: number[],
  threshold: number
): number {
  if (candidates.length === 0) return boxStart
  const boxEnd = boxStart + boxLen
  let best = boxStart
  let bestDelta = Infinity
  for (const c of candidates) {
    // Snap left/top edge.
    const dStart = c - boxStart
    if (Math.abs(dStart) < threshold && Math.abs(dStart) < bestDelta) {
      best = c
      bestDelta = Math.abs(dStart)
    }
    // Snap right/bottom edge.
    const dEnd = c - boxEnd
    if (Math.abs(dEnd) < threshold && Math.abs(dEnd) < bestDelta) {
      best = c - boxLen
      bestDelta = Math.abs(dEnd)
    }
  }
  return best
}

function wallCandidates(walls: Wall[], axis: Axis): number[] {
  const out = new Set<number>()
  for (const w of walls) {
    if (axis === 'x') {
      // A wall segment with horizontal extent contributes a vertical-edge
      // candidate at its min and max x.
      if (w.start.x !== w.end.x) {
        out.add(Math.min(w.start.x, w.end.x))
        out.add(Math.max(w.start.x, w.end.x))
      } else {
        out.add(w.start.x)
      }
    } else {
      if (w.start.y !== w.end.y) {
        out.add(Math.min(w.start.y, w.end.y))
        out.add(Math.max(w.start.y, w.end.y))
      } else {
        out.add(w.start.y)
      }
    }
  }
  return [...out]
}

function moduleCandidates(others: SnapBox[], axis: Axis): number[] {
  const out = new Set<number>()
  for (const b of others) {
    if (axis === 'x') {
      out.add(b.x)
      out.add(b.x + b.w)
    } else {
      out.add(b.y)
      out.add(b.y + b.h)
    }
  }
  return [...out]
}

/**
 * Snap a box's edges to wall edges within `threshold` mm. Returns the
 * possibly-adjusted top-left corner.
 */
export function snapToWalls(
  box: SnapBox,
  walls: Wall[],
  threshold: number = WALL_SNAP_THRESHOLD
): Vec2 {
  return {
    x: snapAxis(box.x, box.w, wallCandidates(walls, 'x'), threshold),
    y: snapAxis(box.y, box.h, wallCandidates(walls, 'y'), threshold),
  }
}

/**
 * Snap a box's edges to other modules' edges within `threshold` mm. Returns the
 * possibly-adjusted top-left corner.
 */
export function snapToModules(
  box: SnapBox,
  others: SnapBox[],
  threshold: number = MODULE_SNAP_THRESHOLD
): Vec2 {
  return {
    x: snapAxis(box.x, box.w, moduleCandidates(others, 'x'), threshold),
    y: snapAxis(box.y, box.h, moduleCandidates(others, 'y'), threshold),
  }
}

/**
 * Combined snap pipeline used during drag: walls first (30 mm), then other
 * modules (10 mm). Modules win in the close range.
 */
export function snapModule(box: SnapBox, walls: Wall[], others: SnapBox[]): Vec2 {
  const afterWalls = snapToWalls(box, walls)
  const afterModules = snapToModules(
    { ...box, x: afterWalls.x, y: afterWalls.y },
    others
  )
  return afterModules
}
