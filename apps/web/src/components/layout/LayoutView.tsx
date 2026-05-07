import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Line, Rect, Text, Group } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useProjectStore } from '../../store'
import { useToastStore } from '../../store/toasts'
import { api } from '../../lib/api'
import { mmToPx, pxToMm } from '../../lib/coords'
import { snapModule, type SnapBox } from '../../lib/snap'
import { withToast } from '../../lib/withToast'
import {
  STANDARD_MODULES,
  validateLayout,
  moduleFootprint,
  type Layout,
  type Module,
  type ValidatorResult,
} from '@galley/shared'

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

type SwapMenu = { moduleId: string; canvasX: number; canvasY: number } | null

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function safeFilenameStem(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
  return cleaned || 'project'
}

function timestampForFilename(): string {
  // Filesystem-safe ISO-ish timestamp: 2026-05-07T14-32-09
  return new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function LayoutView() {
  const project = useProjectStore((s) => s.project)
  const setLocal = useProjectStore((s) => s.setLocal)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [swapMenu, setSwapMenu] = useState<SwapMenu>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const overlayLayerRef = useRef<Konva.Layer | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const validation = useMemo<ValidatorResult>(() => {
    if (!project?.layout || !project.preferences) return { ok: true, violations: [] }
    return validateLayout({
      walls: project.walls,
      fixedPoints: project.fixedPoints,
      modules: project.layout.modules,
      hobType: project.preferences.hobType,
    })
  }, [project])

  const persistLayout = useCallback(
    (layout: Layout) => {
      if (!project) return
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        // The post-save setLocal acknowledges an already-applied optimistic
        // update — pass `snapshot: false` so it doesn't add a duplicate entry
        // to the undo stack on top of the one updateModules already pushed.
        withToast(api.saveLayout(project.id, layout), {
          errorMessage: 'Failed to save layout changes',
        })
          .then((next) => setLocal(next, { snapshot: false }))
          .catch(() => {
            // Toast already shown by withToast.
          })
      }, 250)
    },
    [project, setLocal]
  )

  const updateModules = useCallback(
    (mapper: (m: Module) => Module | null) => {
      if (!project?.layout) return
      const nextModules: Module[] = []
      for (const m of project.layout.modules) {
        const result = mapper(m)
        if (result !== null) nextModules.push(result)
      }
      const nextLayout: Layout = { ...project.layout, modules: nextModules }
      setLocal({ ...project, layout: nextLayout })
      persistLayout(nextLayout)
    },
    [project, setLocal, persistLayout]
  )

  // Keyboard shortcuts: R rotates, Delete/Backspace removes the selected module.
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (isTypingTarget(ev.target)) return
      if (!selectedId) return
      if (ev.key === 'r' || ev.key === 'R') {
        ev.preventDefault()
        updateModules((m) => {
          if (m.id !== selectedId) return m
          const next = ((m.rotation + 90) % 360) as Module['rotation']
          return { ...m, rotation: next }
        })
      } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault()
        const idToDelete = selectedId
        setSelectedId(null)
        updateModules((m) => (m.id === idToDelete ? null : m))
      } else if (ev.key === 'Escape') {
        setSelectedId(null)
        setSwapMenu(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, updateModules])

  // Close the swap menu on outside click / escape.
  useEffect(() => {
    if (!swapMenu) return
    const close = () => setSwapMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [swapMenu])

  const layout: Layout | null = project?.layout ?? null
  const selectedModule = useMemo<Module | null>(() => {
    if (!layout || !selectedId) return null
    return layout.modules.find((m) => m.id === selectedId) ?? null
  }, [layout, selectedId])

  if (!project) return null

  const pxPerMm = project.scale?.pxPerMm
  const canGenerate =
    project.preferences != null && project.walls.length > 0 && pxPerMm != null
  const canExport = project.layout != null && pxPerMm != null
  const hasLayout = project.layout != null && pxPerMm != null

  async function generate() {
    if (!project) return
    setBusy(true)
    try {
      const result = await withToast(api.generateLayout(project.id), {
        errorMessage: 'Failed to generate layout',
        trackInFlight: true,
      })
      setLocal({ ...project, layout: result.layout })
      setSelectedId(null)
      if (result.warning) {
        useToastStore.getState().push('warning', result.warning)
      }
    } catch {
      // Toast already shown by withToast.
    } finally {
      setBusy(false)
    }
  }

  function handleStageBackgroundDown(
    ev: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    // Click on empty stage clears selection.
    if (ev.target === ev.target.getStage()) {
      setSelectedId(null)
      setSwapMenu(null)
    }
  }

  function handleDragMove(m: Module, e: KonvaEventObject<DragEvent>) {
    if (pxPerMm == null || !layout || !project) return
    const node = e.target
    const posPx = { x: node.x(), y: node.y() }
    const posMm = pxToMm(posPx, pxPerMm)
    const fp = moduleFootprint(m)
    const box: SnapBox = { x: posMm.x, y: posMm.y, w: fp.w, h: fp.h }
    const others: SnapBox[] = layout.modules
      .filter((o) => o.id !== m.id)
      .map((o) => {
        const f = moduleFootprint(o)
        return { x: f.x, y: f.y, w: f.w, h: f.h }
      })
    const snapped = snapModule(box, project.walls, others)
    const snappedPx = mmToPx(snapped, pxPerMm)
    node.x(snappedPx.x)
    node.y(snappedPx.y)
  }

  function handleDragEnd(m: Module, e: KonvaEventObject<DragEvent>) {
    if (pxPerMm == null) return
    const node = e.target
    const posMm = pxToMm({ x: node.x(), y: node.y() }, pxPerMm)
    updateModules((cur) =>
      cur.id === m.id ? { ...cur, position: { x: posMm.x, y: posMm.y } } : cur
    )
  }

  function handleContextMenu(m: Module, e: KonvaEventObject<PointerEvent>) {
    e.evt.preventDefault()
    setSelectedId(m.id)
    const stage = stageRef.current
    if (!stage || !containerRef.current) return
    const stageBox = stage.container().getBoundingClientRect()
    const containerBox = containerRef.current.getBoundingClientRect()
    setSwapMenu({
      moduleId: m.id,
      canvasX: stageBox.left - containerBox.left + (e.evt.clientX - stageBox.left),
      canvasY: stageBox.top - containerBox.top + (e.evt.clientY - stageBox.top),
    })
  }

  function applySwap(moduleId: string, newWidth: number) {
    updateModules((cur) => (cur.id === moduleId ? { ...cur, width: newWidth } : cur))
    setSwapMenu(null)
  }

  function exportPng() {
    const stage = stageRef.current
    if (!stage || !project) return
    const overlay = overlayLayerRef.current
    const previousSelection = selectedId
    if (overlay) overlay.visible(false)
    setSelectedId(null)
    // Force the stage to redraw without overlay/selection chrome before
    // serialising. Konva batchDraw is async; we use draw() so the next call is
    // guaranteed to capture the cleaned frame.
    stage.draw()
    const dataUrl = stage.toDataURL({ pixelRatio: 2 })
    if (overlay) overlay.visible(true)
    setSelectedId(previousSelection)
    stage.draw()
    const filename = `${safeFilenameStem(project.name)}-${timestampForFilename()}.png`
    triggerDownload(dataUrl, filename)
  }

  function exportJson() {
    if (!project) return
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    try {
      const filename = `${safeFilenameStem(project.name)}-${timestampForFilename()}.json`
      triggerDownload(url, filename)
    } finally {
      // Revoke shortly after the click so the download can resolve in all browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  return (
    <div ref={containerRef} className="relative grid grid-cols-[1fr_300px] gap-6">
      <div className="space-y-3">
        {project.layout?.rationale && (
          <div className="rounded border border-line bg-white px-3 py-2 text-sm">
            <span className="font-medium">Rationale: </span>
            <span className="text-stone-600">{project.layout.rationale}</span>
          </div>
        )}
        <div className="rounded border border-line bg-white">
          <Stage
            ref={stageRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onMouseDown={handleStageBackgroundDown}
            onTouchStart={handleStageBackgroundDown}
          >
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
                    <Group
                      key={m.id}
                      x={x}
                      y={y}
                      draggable
                      onClick={() => setSelectedId(m.id)}
                      onTap={() => setSelectedId(m.id)}
                      onDragMove={(e) => handleDragMove(m, e)}
                      onDragEnd={(e) => handleDragEnd(m, e)}
                      onContextMenu={(e) => handleContextMenu(m, e)}
                    >
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
                        listening={false}
                      />
                    </Group>
                  )
                })}
            </Layer>
            {/* Overlay layer holds editor chrome (selection outlines) so PNG
                export can hide it without disturbing the modules themselves. */}
            <Layer ref={overlayLayerRef} listening={false}>
              {pxPerMm != null && selectedModule && (
                <SelectionOutline module={selectedModule} pxPerMm={pxPerMm} />
              )}
            </Layer>
          </Stage>
        </div>
        {hasLayout && (
          <p className="text-xs text-stone-500">
            Click a module to select. Drag to move (snaps to walls and modules).
            Press <kbd className="rounded border border-line bg-white px-1">R</kbd> to rotate,
            <kbd className="ml-1 rounded border border-line bg-white px-1">Del</kbd> to remove,
            right-click to swap width.
          </p>
        )}
      </div>

      <aside className="space-y-4">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Generate
          </h2>
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
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Export
          </h2>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded border border-line bg-white px-3 py-2 text-sm disabled:opacity-50"
              onClick={exportPng}
              disabled={!canExport}
            >
              Export PNG
            </button>
            <button
              className="flex-1 rounded border border-line bg-white px-3 py-2 text-sm disabled:opacity-50"
              onClick={exportJson}
              disabled={!canExport}
            >
              Export JSON
            </button>
          </div>
          {!canExport && (
            <p className="text-xs text-stone-500">Generate a layout to enable export.</p>
          )}
        </section>

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

      {swapMenu && (
        <SwapMenuPopup
          menu={swapMenu}
          modules={layout?.modules ?? []}
          onSwap={applySwap}
          onClose={() => setSwapMenu(null)}
        />
      )}
    </div>
  )
}

function SelectionOutline({ module: m, pxPerMm }: { module: Module; pxPerMm: number }) {
  const fp = moduleFootprint(m)
  return (
    <Rect
      x={fp.x * pxPerMm - 2}
      y={fp.y * pxPerMm - 2}
      width={fp.w * pxPerMm + 4}
      height={fp.h * pxPerMm + 4}
      stroke="#2563eb"
      strokeWidth={2}
      dash={[6, 4]}
      listening={false}
    />
  )
}

function SwapMenuPopup({
  menu,
  modules,
  onSwap,
  onClose,
}: {
  menu: NonNullable<SwapMenu>
  modules: Module[]
  onSwap: (moduleId: string, width: number) => void
  onClose: () => void
}) {
  const target = modules.find((m) => m.id === menu.moduleId)
  if (!target) return null
  const widths = STANDARD_MODULES[target.kind].widths.filter((w) => w !== target.width)
  return (
    <div
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute z-10 min-w-[12rem] rounded border border-line bg-white py-1 shadow"
      style={{ left: menu.canvasX, top: menu.canvasY }}
    >
      <div className="px-3 py-1 text-xs uppercase tracking-wide text-stone-500">
        Swap {target.kind.replace('_', ' ')} to…
      </div>
      {widths.length === 0 ? (
        <div className="px-3 py-1 text-sm text-stone-500">No alternative widths.</div>
      ) : (
        widths.map((w) => (
          <button
            key={w}
            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-stone-100"
            onClick={() => onSwap(target.id, w)}
          >
            {w} mm
          </button>
        ))
      )}
      <div className="border-t border-line px-3 py-1 text-right text-xs text-stone-500">
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
