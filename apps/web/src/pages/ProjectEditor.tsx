import { useEffect, useState } from 'react'
import { useProjectStore } from '../store'
import { BlueprintEditor } from '../components/editor/BlueprintEditor'
import { QAWizard } from '../components/qa/QAWizard'
import { LayoutView } from '../components/layout/LayoutView'

type Tab = 'editor' | 'qa' | 'layout'

export function ProjectEditor({ id }: { id: string }) {
  const { project, loading, error, load } = useProjectStore()
  const [tab, setTab] = useState<Tab>('editor')

  useEffect(() => {
    void load(id)
  }, [id, load])

  if (loading) return <p className="text-sm text-stone-500">Loading…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!project) return null

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <a href="#/" className="text-sm text-stone-500 hover:underline">
          ← Back to projects
        </a>
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
