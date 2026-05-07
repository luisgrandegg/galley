import { Circle, Group, Layer, Rect, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import {
  CLEARANCES,
  type FixedPoint,
  type FixedPointKind,
  type Vec2,
} from '@galley/shared'
import { mmToPx, pxToMm } from '../../lib/coords'

/** Consistent palette across the editor and the toolbar buttons. */
export const FIXED_POINT_COLOURS: Record<FixedPointKind, string> = {
  water: '#2563eb', // blue
  drain: '#0f766e', // teal
  gas: '#ea580c', // orange
  electric: '#facc15', // amber
  door: '#7c3aed', // violet
  window: '#0ea5e9', // sky
}

export const FIXED_POINT_LABELS: Record<FixedPointKind, string> = {
  water: 'Water',
  drain: 'Drain',
  gas: 'Gas',
  electric: 'Electric',
  door: 'Door',
  window: 'Window',
}

export const FIXED_POINT_KINDS: FixedPointKind[] = [
  'water',
  'drain',
  'gas',
  'electric',
  'door',
  'window',
]

/**
 * Default widths used when the user supplies an unparseable / blank value via
 * the prompt. Values are in mm.
 */
const DEFAULT_DOOR_WIDTH = 800
const DEFAULT_WINDOW_WIDTH = 1000

export type FixedPointPlacement = {
  /** Pixel position relative to the Konva stage. */
  cursorPx: Vec2
  kind: FixedPointKind
}

/**
 * Build a new `FixedPoint` for the given kind at the given mm position. For
 * doors and windows, prompt the user for the additional fields. Returns null
 * if the user cancels the prompt.
 */
export function buildFixedPoint(
  kind: FixedPointKind,
  position: Vec2
): FixedPoint | null {
  const id = crypto.randomUUID()
  if (kind === 'door') {
    const widthInput = window.prompt('Door width (mm)?', String(DEFAULT_DOOR_WIDTH))
    if (widthInput === null) return null
    const swingInput = window.prompt('Door swing — "left", "right", or "none"?', 'right')
    if (swingInput === null) return null
    const width = parseWidth(widthInput, DEFAULT_DOOR_WIDTH)
    const swing = parseSwing(swingInput)
    return { id, kind, position, width, swing }
  }
  if (kind === 'window') {
    const widthInput = window.prompt('Window width (mm)?', String(DEFAULT_WINDOW_WIDTH))
    if (widthInput === null) return null
    const width = parseWidth(widthInput, DEFAULT_WINDOW_WIDTH)
    return { id, kind, position, width }
  }
  return { id, kind, position }
}

function parseWidth(input: string, fallback: number): number {
  const n = Number(input)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function parseSwing(input: string): 'left' | 'right' | 'none' {
  const v = input.trim().toLowerCase()
  if (v === 'left' || v === 'right' || v === 'none') return v
  return 'right'
}

export type FixedPointToolProps = {
  fixedPoints: FixedPoint[]
  pxPerMm: number
  /** When set, dragging is enabled so the user can refine positions. */
  draggable: boolean
  onChange: (next: FixedPoint[]) => void
}

/**
 * F-010 — Fixed-point placement tool.
 *
 * Renders the project's fixed points as a Konva layer. Each kind has a
 * distinct shape/colour. When `draggable` is true, the user can refine
 * positions; on `dragend` the new mm position is persisted via `onChange`.
 *
 * Click-to-place is owned by the parent editor (Stage `onClick`); the parent
 * calls `buildFixedPoint(...)` and then `onChange([...existing, new])`.
 */
export function FixedPointTool({
  fixedPoints,
  pxPerMm,
  draggable,
  onChange,
}: FixedPointToolProps) {
  function handleDragEnd(id: string, e: KonvaEventObject<DragEvent>) {
    const node = e.target
    const px: Vec2 = { x: node.x(), y: node.y() }
    const mm = pxToMm(px, pxPerMm)
    onChange(
      fixedPoints.map((fp) => (fp.id === id ? { ...fp, position: mm } : fp))
    )
  }

  return (
    <Layer>
      {fixedPoints.map((fp) => {
        const c = mmToPx(fp.position, pxPerMm)
        const colour = FIXED_POINT_COLOURS[fp.kind]
        return (
          <Group
            key={fp.id}
            x={c.x}
            y={c.y}
            draggable={draggable}
            onDragEnd={(e) => handleDragEnd(fp.id, e)}
          >
            {renderMarker(fp, pxPerMm, colour)}
          </Group>
        )
      })}
    </Layer>
  )
}

function renderMarker(fp: FixedPoint, pxPerMm: number, colour: string) {
  if (fp.kind === 'door') {
    const widthPx = (fp.width ?? DEFAULT_DOOR_WIDTH) * pxPerMm
    // A short rect along the wall axis plus a swing-direction tick.
    const swing = fp.swing ?? 'none'
    const tick = swing === 'left' ? -widthPx / 2 : swing === 'right' ? widthPx / 2 : 0
    return (
      <>
        <Rect
          x={-widthPx / 2}
          y={-3}
          width={widthPx}
          height={6}
          fill={colour}
          stroke="#1c1917"
          strokeWidth={1}
        />
        {swing !== 'none' && (
          <Rect
            x={tick - 1}
            y={-3}
            width={2}
            height={Math.min(20, CLEARANCES.doorSwing * pxPerMm * 0.1)}
            fill={colour}
          />
        )}
        <Text
          text="D"
          fontSize={10}
          fill="#ffffff"
          x={-3}
          y={-5}
        />
      </>
    )
  }
  if (fp.kind === 'window') {
    const widthPx = (fp.width ?? DEFAULT_WINDOW_WIDTH) * pxPerMm
    return (
      <>
        <Rect
          x={-widthPx / 2}
          y={-2}
          width={widthPx}
          height={4}
          fill={colour}
          stroke="#1c1917"
          strokeWidth={1}
        />
        <Text text="W" fontSize={10} fill="#1c1917" x={-3} y={-14} />
      </>
    )
  }
  // water / drain / gas / electric — small coloured circle with a single
  // letter label so the kind is visible at a glance.
  const letter = fp.kind === 'electric' ? 'E' : fp.kind[0]!.toUpperCase()
  return (
    <>
      <Circle radius={8} fill={colour} stroke="#1c1917" strokeWidth={1} />
      <Text text={letter} fontSize={10} fill="#ffffff" x={-3} y={-5} />
    </>
  )
}
