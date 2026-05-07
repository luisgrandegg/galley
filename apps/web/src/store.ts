import { create } from 'zustand'
import type { Project } from '@galley/shared'
import { api } from './lib/api'

type State = {
  project: Project | null
  loading: boolean
  error: string | null
  load: (id: string) => Promise<void>
  patch: (patch: Partial<Project>) => Promise<void>
  setLocal: (project: Project) => void
  reset: () => void
}

export const useProjectStore = create<State>((set, get) => ({
  project: null,
  loading: false,
  error: null,
  async load(id) {
    set({ loading: true, error: null })
    try {
      const project = await api.getProject(id)
      set({ project, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },
  async patch(patch) {
    const current = get().project
    if (!current) return
    const optimistic = { ...current, ...patch }
    set({ project: optimistic })
    try {
      const next = await api.updateProject(current.id, patch)
      set({ project: next })
    } catch (err) {
      set({ project: current, error: err instanceof Error ? err.message : String(err) })
    }
  },
  setLocal(project) {
    set({ project })
  },
  reset() {
    set({ project: null, loading: false, error: null })
  },
}))
