// Per ADR-002: mm is the canonical unit. Pixel ↔ mm conversion happens here
// and only here. Every Konva event handler that produces a position must run
// through pxToMm before storing; every render must run through mmToPx before
// drawing.

import type { Vec2 } from '@galley/shared'

export function pxToMm(p: Vec2, pxPerMm: number): Vec2 {
  return { x: p.x / pxPerMm, y: p.y / pxPerMm }
}

export function mmToPx(p: Vec2, pxPerMm: number): Vec2 {
  return { x: p.x * pxPerMm, y: p.y * pxPerMm }
}
