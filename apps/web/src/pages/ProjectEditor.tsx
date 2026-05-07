import { useEffect, useState } from 'react'
import { useProjectStore } from '../store'
import { useShortcutsPanel } from '../store/shortcutsPanel'
import { isEditableTarget } from '../lib/keyboard'
import { BlueprintEditor } from '../components/editor/BlueprintEditor'
import { QAWizard } from '../components/qa/QAWizard'
import { LayoutView } from '../components/layout/LayoutView'

type Tab = 'editor' | 'qa' | 'layout'

export function ProjectEditor({ id }: { id: string }) {
  const project = useProjectStore((s) => s.project)
  const loading = useProjectStore((s) => s.loading)
  const error = useProjectStore((s) => s.error)
  const load = useProjectStore((s) => s.load)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useProjectStore((s) => s.pastStack.length > 0)
  const canRedo = useProjectStore((s) => s.futureStack.length > 0)
  const openShortcuts = useShortcutsPanel((s) => s.open)
  const [tab, setTab] = useState<Tab>('editor')

  useEffect(() => {
    void load(id)
  }, [id, load])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()

      // Cmd/Ctrl+Shift+Z or Ctrl+Y → redo
      if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        void redo()
        return
      }
      // Cmd/Ctrl+Z (no shift) → undo
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        void undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  if (loading) return <p className="text-sm text-stone-500">Loading…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!project) return null

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded border border-line bg-white p-1">
            <button
              type="button"
              onClick={() => void undo()}
              disabled={!canUndo}
              aria-label="Undo"
              className="rounded px-2 py-1 text-sm text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => void redo()}
              disabled={!canRedo}
              aria-label="Redo"
              className="rounded px-2 py-1 text-sm text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Redo
            </button>
          </div>
          <button
            type="button"
            onClick={openShortcuts}
            aria-label="Show keyboard shortcuts"
            className="rounded border border-line bg-white px-2 py-1 text-sm text-stone-600 hover:bg-stone-100"
          >
            Shortcuts
          </button>
          <a href="#/" className="text-sm text-stone-500 hover:underline">
            ← Back to projects
          </a>
        </div>
      </header>

      <nav className="flex gap-1 rounded border border-line bg-white p-1 w-fit">
        {(['editor', 'qa', 'layout'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === t ? 'bg-ink text-bone' : 'text-stone-600 hover:bg-stone-100'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'editor' ? 'Blueprint' : t === 'qa' ? 'Q&A' : 'Layout'}
          </button>
        ))}
      </nav>

      {tab === 'editor' && <BlueprintEditor />}
      {tab === 'qa' && <QAWizard />}
      {tab === 'layout' && <LayoutView />}
    </div>
  )
}
