import { useEffect, useState } from 'react'
import { api, type ProjectSummary } from '../lib/api'

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    try {
      setProjects(await api.listProjects())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const project = await api.createProject(name.trim())
      window.location.hash = `#/projects/${project.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this project?')) return
    await api.deleteProject(id)
    void refresh()
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
          Create
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
