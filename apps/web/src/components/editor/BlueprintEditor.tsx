import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KImage, Line } from 'react-konva'
import { useProjectStore } from '../../store'
import { api } from '../../lib/api'
import { mmToPx } from '../../lib/coords'
import { ScaleTool } from './ScaleTool'

const CANVAS_W = 900
const CANVAS_H = 600

export function BlueprintEditor() {
  const project = useProjectStore((s) => s.project)
  const setLocal = useProjectStore((s) => s.setLocal)
  const fileRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!project?.blueprint) {
      setImage(null)
      return
    }
    const img = new window.Image()
    img.src = api.blueprintUrl(project.id)
    img.onload = () => setImage(img)
  }, [project?.id, project?.blueprint])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !project) return
    setUploading(true)
    try {
      const dims = await readImageDims(file)
      const next = await api.uploadBlueprint(project.id, file, dims.width, dims.height)
      setLocal(next)
    } finally {
      setUploading(false)
    }
  }

  if (!project) return null

  const pxPerMm = project.scale?.pxPerMm ?? null

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
            Walls
          </h2>
          <p className="text-sm text-stone-500">
            {project.walls.length} segment(s) — wall-tracing tool ships in F-008.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Fixed points
          </h2>
          <p className="text-sm text-stone-500">
            {project.fixedPoints.length} placed — toolbar ships in F-010.
          </p>
        </section>
      </aside>

      <div className="rounded border border-line bg-white">
        <Stage width={CANVAS_W} height={CANVAS_H}>
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
