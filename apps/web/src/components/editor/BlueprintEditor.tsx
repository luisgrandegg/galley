import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KImage, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { FixedPointKind, Vec2, Wall } from '@galley/shared'
import { useProjectStore } from '../../store'
import { api } from '../../lib/api'
import { mmToPx } from '../../lib/coords'
import { withToast } from '../../lib/withToast'
import { ScaleTool } from './ScaleTool'
import { WallTraceTool, type WallTraceHandle } from './WallTraceTool'
import {
  FIXED_POINT_COLOURS,
  FIXED_POINT_KINDS,
  FIXED_POINT_LABELS,
  FixedPointTool,
  buildFixedPoint,
} from './FixedPointTool'

const CANVAS_W = 900
const CANVAS_H = 600

type EditorMode =
  | { kind: 'idle' }
  | { kind: 'tracing' }
  | { kind: 'placing'; fixed: FixedPointKind }

export function BlueprintEditor() {
  const project = useProjectStore((s) => s.project)
  const setLocal = useProjectStore((s) => s.setLocal)
  const patch = useProjectStore((s) => s.patch)
  const fileRef = useRef<HTMLInputElement>(null)
  const traceRef = useRef<WallTraceHandle>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<EditorMode>({ kind: 'idle' })
  const [cursorPx, setCursorPx] = useState<Vec2 | null>(null)

  useEffect(() => {
    if (!project?.blueprint) {
      setImage(null)
      return
    }
    const img = new window.Image()
    img.src = api.blueprintUrl(project.id)
    img.onload = () => setImage(img)
  }, [project?.id, project?.blueprint])

  // Esc exits any active tool mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode({ kind: 'idle' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !project) return
    setUploading(true)
    try {
      const dims = await withToast(readImageDims(file), {
        errorMessage: 'Could not read the selected image',
      })
      const next = await withToast(
        api.uploadBlueprint(project.id, file, dims.width, dims.height),
        { errorMessage: 'Failed to upload blueprint', trackInFlight: true },
      )
      setLocal(next)
    } catch {
      // withToast already pushed an error toast; nothing more to do here.
    } finally {
      setUploading(false)
    }
  }

  if (!project) return null
  const proj = project // capture narrowed value for closures below

  const pxPerMm = proj.scale?.pxPerMm ?? null
  const scaleSet = pxPerMm != null
  const tracing = mode.kind === 'tracing'
  const placingKind = mode.kind === 'placing' ? mode.fixed : null

  function toggleMode(next: EditorMode) {
    setMode((current) => {
      if (current.kind === next.kind) {
        if (current.kind === 'placing' && next.kind === 'placing' && current.fixed === next.fixed) {
          return { kind: 'idle' }
        }
        if (current.kind === 'tracing' && next.kind === 'tracing') {
          return { kind: 'idle' }
        }
      }
      return next
    })
  }

  // Stage event handlers — dispatch to the active tool. The Stage owns events;
  // the tools are presentational + imperative.
  function getStageCursor(e: KonvaEventObject<MouseEvent>): Vec2 | null {
    const stage = e.target.getStage()
    if (!stage) return null
    const p = stage.getPointerPosition()
    return p ? { x: p.x, y: p.y } : null
  }

  function onStageMouseMove(e: KonvaEventObject<MouseEvent>) {
    setCursorPx(getStageCursor(e))
  }

  function onStageMouseLeave() {
    setCursorPx(null)
  }

  async function onStageClick(e: KonvaEventObject<MouseEvent>) {
    if (!pxPerMm) return
    const cursor = getStageCursor(e)
    if (!cursor) return
    if (mode.kind === 'tracing') {
      traceRef.current?.click(cursor)
      return
    }
    if (mode.kind === 'placing') {
      const mm = { x: cursor.x / pxPerMm, y: cursor.y / pxPerMm }
      const fp = buildFixedPoint(mode.fixed, mm)
      if (!fp) return
      await patch({ fixedPoints: [...proj.fixedPoints, fp] })
    }
  }

  function onStageDblClick() {
    if (mode.kind === 'tracing') {
      traceRef.current?.dblClick()
    }
  }

  async function commitWalls(walls: Wall[]) {
    await patch({ walls: [...proj.walls, ...walls] })
    setMode({ kind: 'idle' })
  }

  async function setFixedPoints(next: typeof proj.fixedPoints) {
    await patch({ fixedPoints: next })
  }

  return (
    <div className="grid grid-cols-[260px_1fr] gap-6">
      <aside className="space-y-4">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Blueprint
          </h2>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={onFile}
          />
          <button
            className="mt-2 w-full rounded border border-line bg-white px-3 py-2 text-sm hover:bg-stone-50"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {project.blueprint ? 'Replace image…' : 'Upload image…'}
          </button>
          {uploading && <p className="text-xs text-stone-500 mt-1">Uploading…</p>}
        </section>

        <ScaleTool />

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Scale
          </h2>
          <p className="text-sm">
            {pxPerMm == null ? (
              <span className="text-stone-500">Not set</span>
            ) : (
              <>{pxPerMm.toFixed(4)} px / mm</>
            )}
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Tools
          </h2>
          {!scaleSet && (
            <p className="mt-1 text-xs text-stone-500">
              Set scale before tracing or placing fixed points.
            </p>
          )}
          <div className="mt-2 space-y-2">
            <button
              className={`w-full rounded border px-3 py-2 text-sm ${
                tracing
                  ? 'border-ink bg-ink text-bone'
                  : 'border-line bg-white hover:bg-stone-50'
              } disabled:opacity-50`}
              onClick={() => toggleMode({ kind: 'tracing' })}
              disabled={!scaleSet}
              title={scaleSet ? undefined : 'Set scale first'}
            >
              {tracing ? 'Tracing… (click) — Esc to exit' : 'Trace walls'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              {FIXED_POINT_KINDS.map((kind) => {
                const active = placingKind === kind
                return (
                  <button
                    key={kind}
                    className={`flex items-center gap-2 rounded border px-2 py-2 text-xs ${
                      active
                        ? 'border-ink bg-ink text-bone'
                        : 'border-line bg-white hover:bg-stone-50'
                    } disabled:opacity-50`}
                    onClick={() => toggleMode({ kind: 'placing', fixed: kind })}
                    disabled={!scaleSet}
                    title={scaleSet ? undefined : 'Set scale first'}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-line"
                      style={{ background: FIXED_POINT_COLOURS[kind] }}
                    />
                    {FIXED_POINT_LABELS[kind]}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Walls
          </h2>
          <p className="text-sm text-stone-500">
            {project.walls.length} segment(s)
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Fixed points
          </h2>
          <p className="text-sm text-stone-500">{project.fixedPoints.length} placed</p>
        </section>
      </aside>

      <div className="rounded border border-line bg-white">
        <Stage
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseMove={onStageMouseMove}
          onMouseLeave={onStageMouseLeave}
          onClick={(e) => void onStageClick(e)}
          onDblClick={onStageDblClick}
          style={{
            cursor:
              mode.kind === 'idle' ? 'default' : scaleSet ? 'crosshair' : 'not-allowed',
          }}
        >
          <Layer>
            {image && (
              <KImage
                image={image}
                width={CANVAS_W}
                height={(image.height / image.width) * CANVAS_W}
                opacity={0.6}
              />
            )}
          </Layer>
          <Layer>
            {pxPerMm != null &&
              project.walls.map((w) => {
                const a = mmToPx(w.start, pxPerMm)
                const b = mmToPx(w.end, pxPerMm)
                return (
                  <Line
                    key={w.id}
                    points={[a.x, a.y, b.x, b.y]}
                    stroke="#1c1917"
                    strokeWidth={3}
                  />
                )
              })}
          </Layer>
          {pxPerMm != null && (
            <FixedPointTool
              fixedPoints={project.fixedPoints}
              pxPerMm={pxPerMm}
              draggable={mode.kind === 'idle'}
              onChange={(next) => void setFixedPoints(next)}
            />
          )}
          {pxPerMm != null && (
            <WallTraceTool
              ref={traceRef}
              active={tracing}
              pxPerMm={pxPerMm}
              cursorPx={cursorPx}
              onCommit={(walls) => void commitWalls(walls)}
            />
          )}
        </Stage>
      </div>
    </div>
  )
}

function readImageDims(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}
