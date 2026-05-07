import { useEffect, useImperativeHandle, useState, forwardRef } from 'react'
import { Circle, Layer, Line } from 'react-konva'
import { DEFAULT_WALL_THICKNESS, type Vec2, type Wall } from '@galley/shared'
import { mmToPx, pxToMm } from '../../lib/coords'

/**
 * Snap an arbitrary mm-space point to a 5° angle increment relative to an
 * anchor. The cursor's distance to the anchor is preserved; only its angle is
 * snapped. Holding Shift bypasses snapping (free-rotate).
 */
function snapToAngle(anchor: Vec2, target: Vec2, shift: boolean): Vec2 {
  if (shift) return target
  const dx = target.x - anchor.x
  const dy = target.y - anchor.y
  const radius = Math.hypot(dx, dy)
  if (radius === 0) return target
  const angle = Math.atan2(dy, dx)
  const step = (5 * Math.PI) / 180
  const snapped = Math.round(angle / step) * step
  return { x: anchor.x + Math.cos(snapped) * radius, y: anchor.y + Math.sin(snapped) * radius }
}

export type WallTraceHandle = {
  /** Called by the parent on a single click on the stage; appends a vertex. */
  click: (cursorPx: Vec2) => void
  /** Called by the parent on a double-click; closes the polyline and emits walls. */
  dblClick: () => void
}

export type WallTraceToolProps = {
  active: boolean
  pxPerMm: number
  /** Cursor position relative to the Konva stage, in *pixels*. Null when off-stage. */
  cursorPx: Vec2 | null
  /** Called with the new walls when a polyline closes; the editor persists. */
  onCommit: (walls: Wall[]) => void
}

/**
 * F-008 — Wall tracing tool.
 *
 * Renders the in-progress polyline as a Konva layer. Imperative click/dblclick
 * handlers are exposed via ref to the parent editor (which owns the Stage).
 * All stored coordinates are in mm via `pxToMm`. Wall thickness defaults to
 * `DEFAULT_WALL_THICKNESS` from `@galley/shared`.
 */
export const WallTraceTool = forwardRef<WallTraceHandle, WallTraceToolProps>(
  function WallTraceTool({ active, pxPerMm, cursorPx, onCommit }, ref) {
    const [vertices, setVertices] = useState<Vec2[]>([])
    const [shiftHeld, setShiftHeld] = useState(false)

    // Reset the buffer whenever the tool is deactivated.
    useEffect(() => {
      if (!active) setVertices([])
    }, [active])

    // Track Shift to disable angle snapping while held.
    useEffect(() => {
      if (!active) return
      const onDown = (e: KeyboardEvent) => {
        if (e.key === 'Shift') setShiftHeld(true)
      }
      const onUp = (e: KeyboardEvent) => {
        if (e.key === 'Shift') setShiftHeld(false)
      }
      window.addEventListener('keydown', onDown)
      window.addEventListener('keyup', onUp)
      return () => {
        window.removeEventListener('keydown', onDown)
        window.removeEventListener('keyup', onUp)
        setShiftHeld(false)
      }
    }, [active])

    useImperativeHandle(
      ref,
      () => ({
        click: (cursor: Vec2) => {
          if (!active) return
          setVertices((prev) => {
            const raw = pxToMm(cursor, pxPerMm)
            const last = prev[prev.length - 1]
            const next = last ? snapToAngle(last, raw, shiftHeld) : raw
            return [...prev, next]
          })
        },
        dblClick: () => {
          if (!active) return
          setVertices((prev) => {
            // The native dblclick fires after a click pair, so `prev` may end
            // with a duplicate of the closing vertex. Drop trailing duplicates
            // before emitting walls.
            const cleaned: Vec2[] = []
            for (const v of prev) {
              const tail = cleaned[cleaned.length - 1]
              if (!tail || tail.x !== v.x || tail.y !== v.y) cleaned.push(v)
            }
            if (cleaned.length < 3) return []
            const walls: Wall[] = []
            for (let i = 0; i < cleaned.length; i++) {
              const start = cleaned[i]!
              const end = cleaned[(i + 1) % cleaned.length]!
              walls.push({
                id: crypto.randomUUID(),
                start,
                end,
                thickness: DEFAULT_WALL_THICKNESS,
              })
            }
            onCommit(walls)
            return []
          })
        },
      }),
      [active, pxPerMm, shiftHeld, onCommit]
    )

    if (!active) return null

    // Snapped preview position for the rubber-band line.
    const last = vertices[vertices.length - 1]
    const rawCursor = cursorPx ? pxToMm(cursorPx, pxPerMm) : null
    const previewMm: Vec2 | null = rawCursor
      ? last
        ? snapToAngle(last, rawCursor, shiftHeld)
        : rawCursor
      : null

    const placedPx = vertices.map((v) => mmToPx(v, pxPerMm))
    const placedFlat = placedPx.flatMap((p) => [p.x, p.y])
    const lastPx = placedPx[placedPx.length - 1]
    const previewPx = previewMm ? mmToPx(previewMm, pxPerMm) : null

    return (
      <Layer listening={false}>
        {placedFlat.length >= 4 && (
          <Line points={placedFlat} stroke="#1c1917" strokeWidth={2} />
        )}
        {lastPx && previewPx && (
          <Line
            points={[lastPx.x, lastPx.y, previewPx.x, previewPx.y]}
            stroke="#78716c"
            strokeWidth={2}
            dash={[6, 4]}
          />
        )}
        {placedPx.map((p, i) => (
          <Circle key={i} x={p.x} y={p.y} radius={4} fill="#1c1917" />
        ))}
        {previewPx && (
          <Circle
            x={previewPx.x}
            y={previewPx.y}
            radius={4}
            stroke="#1c1917"
            strokeWidth={1}
            fill="#ffffff"
          />
        )}
      </Layer>
    )
  }
)
