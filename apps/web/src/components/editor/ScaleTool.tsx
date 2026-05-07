import { useState } from 'react'
import { useProjectStore } from '../../store'

export function ScaleTool() {
  const project = useProjectStore((s) => s.project)
  const patch = useProjectStore((s) => s.patch)
  const [pxDistance, setPxDistance] = useState('')
  const [mmDistance, setMmDistance] = useState('')

  if (!project) return null

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const px = Number(pxDistance)
    const mm = Number(mmDistance)
    if (!Number.isFinite(px) || !Number.isFinite(mm) || px <= 0 || mm <= 0) return
    void patch({ scale: { pxPerMm: px / mm } })
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Set scale</h2>
      <form className="space-y-2 mt-2" onSubmit={apply}>
        <label className="block text-sm">
          Reference (px)
          <input
            className="mt-1 w-full rounded border border-line px-2 py-1 text-sm"
            value={pxDistance}
            onChange={(e) => setPxDistance(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block text-sm">
          Reference (mm)
          <input
            className="mt-1 w-full rounded border border-line px-2 py-1 text-sm"
            value={mmDistance}
            onChange={(e) => setMmDistance(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <button className="w-full rounded bg-ink px-3 py-2 text-sm text-bone" type="submit">
          Apply scale
        </button>
        <p className="text-xs text-stone-500">
          Two-point picker on canvas ships in a follow-up; for now type the px/mm pair manually.
        </p>
      </form>
    </section>
  )
}
