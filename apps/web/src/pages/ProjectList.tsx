import { useEffect, useState } from 'react'
import { api, type ProjectSummary } from '../lib/api'
import { withToast } from '../lib/withToast'
import { useToastStore } from '../store/toasts'

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    try {
      setProjects(
        await withToast(api.listProjects(), { errorMessage: 'Failed to load projects' }),
      )
    } catch {
      // toast already pushed by withToast — swallow so refresh is fire-and-forget.
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const project = await withToast(api.createProject(name.trim()), {
        errorMessage: 'Failed to create project',
      })
      window.location.hash = `#/projects/${project.id}`
    } catch {
      // toast already pushed.
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this project?')) return
    try {
      await withToast(api.deleteProject(id), { errorMessage: 'Failed to delete project' })
      useToastStore.getState().push('success', 'Project deleted')
      void refresh()
    } catch {
      // toast already pushed.
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="mt-1 text-sm text-stone-500">
          Create a project, upload a blueprint, design a kitchen.
        </p>
      </section>

      <form onSubmit={create} className="flex items-center gap-3">
        <input
          className="flex-1 rounded border border-line px-3 py-2"
          placeholder="New project name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <button
          className="rounded bg-ink px-4 py-2 text-bone disabled:opacity-50"
          type="submit"
          disabled={busy || !name.trim()}
        >
          {busy ? 'Creating…' : 'Create'}
        </button>
      </form>

      {projects.length === 0 ? (
        <p className="text-sm text-stone-500">No projects yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded border border-line bg-white">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <a className="font-medium" href={`#/projects/${p.id}`}>
                {p.name}
              </a>
              <div className="flex items-center gap-3 text-sm text-stone-500">
                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                <button
                  className="text-red-600 hover:underline"
                  onClick={() => void remove(p.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
