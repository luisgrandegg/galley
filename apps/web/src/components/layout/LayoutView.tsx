import { useMemo, useState } from 'react'
import { Stage, Layer, Line, Rect, Text, Group } from 'react-konva'
import { useProjectStore } from '../../store'
import { api } from '../../lib/api'
import { mmToPx } from '../../lib/coords'
import { validateLayout, type Module, type ValidatorResult } from '@galley/shared'

const CANVAS_W = 900
const CANVAS_H = 600

const COLOURS: Record<Module['kind'], string> = {
  base_cabinet: '#a8a29e',
  wall_cabinet: '#d6d3d1',
  tall_cabinet: '#78716c',
  sink_unit: '#60a5fa',
  hob_unit: '#f97316',
  oven_tower: '#ef4444',
  fridge: '#34d399',
  dishwasher: '#22d3ee',
  island: '#facc15',
}

export function LayoutView() {
  const project = useProjectStore((s) => s.project)
  const setLocal = useProjectStore((s) => s.setLocal)
  const [busy, setBusy] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validation = useMemo<ValidatorResult>(() => {
    if (!project?.layout || !project.preferences) return { ok: true, violations: [] }
    return validateLayout({
      walls: project.walls,
      fixedPoints: project.fixedPoints,
      modules: project.layout.modules,
      hobType: project.preferences.hobType,
    })
  }, [project])

  if (!project) return null

  const pxPerMm = project.scale?.pxPerMm
  const canGenerate =
    project.preferences != null && project.walls.length > 0 && pxPerMm != null

  async function generate() {
    if (!project) return
    setBusy(true)
    setError(null)
    setWarning(null)
    try {
      const result = await api.generateLayout(project.id)
      setLocal({ ...project, layout: result.layout })
      setWarning(result.warning)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-[1fr_300px] gap-6">
      <div className="space-y-3">
        {project.layout?.rationale && (
          <div className="rounded border border-line bg-white px-3 py-2 text-sm">
            <span className="font-medium">Rationale: </span>
            <span className="text-stone-600">{project.layout.rationale}</span>
          </div>
        )}
        <div className="rounded border border-line bg-white">
          <Stage width={CANVAS_W} height={CANVAS_H}>
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
              {pxPerMm != null &&
                project.layout?.modules.map((m) => {
                  const swap = m.rotation === 90 || m.rotation === 270
                  const w = (swap ? m.depth : m.width) * pxPerMm
                  const h = (swap ? m.width : m.depth) * pxPerMm
                  const x = m.position.x * pxPerMm
                  const y = m.position.y * pxPerMm
                  const flagged = validation.violations.some((v) => v.moduleIds.includes(m.id))
                  return (
                    <Group key={m.id} x={x} y={y}>
                      <Rect
                        width={w}
                        height={h}
                        fill={COLOURS[m.kind]}
                        stroke={flagged ? '#dc2626' : '#1c1917'}
                        strokeWidth={flagged ? 2 : 1}
                      />
                      <Text
                        text={m.label ?? m.kind}
                        width={w}
                        height={h}
                        align="center"
                        verticalAlign="middle"
                        fontSize={11}
                      />
                    </Group>
                  )
                })}
            </Layer>
          </Stage>
        </div>
      </div>

      <aside className="space-y-4">
        <button
          className="w-full rounded bg-ink px-3 py-2 text-sm text-bone disabled:opacity-50"
          onClick={() => void generate()}
          disabled={busy || !canGenerate}
        >
          {busy ? 'Generating…' : project.layout ? 'Regenerate layout' : 'Generate layout'}
        </button>

        {!canGenerate && (
          <p className="text-xs text-stone-500">
            Need: scale set, walls traced, and Q&A finished before generating.
          </p>
        )}

        {warning && <p className="text-sm text-amber-700">{warning}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Validator
          </h2>
          {validation.ok ? (
            <p className="mt-1 text-sm text-emerald-700">All checks pass.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-red-700">
              {validation.violations.map((v, i) => (
                <li key={i}>
                  <span className="font-medium">{v.kind}:</span> {v.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}
