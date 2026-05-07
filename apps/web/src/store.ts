import { create } from 'zustand'
import type { Project } from '@galley/shared'
import { api } from './lib/api'
import { useToastStore } from './store/toasts'

type State = {
  project: Project | null
  loading: boolean
  /**
   * Last error message from `load` or `patch`. Retained for backwards
   * compatibility with any caller that may read it; new UI surfaces should
   * subscribe to the toast store instead, which is where failures are
   * reported now.
   */
  error: string | null
  load: (id: string) => Promise<void>
  patch: (patch: Partial<Project>) => Promise<void>
  setLocal: (project: Project) => void
  reset: () => void
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export const useProjectStore = create<State>((set, get) => ({
  project: null,
  loading: false,
  error: null,
  async load(id) {
    set({ loading: true, error: null })
    useToastStore.getState().beginInFlight()
    try {
      const project = await api.getProject(id)
      set({ project, loading: false })
    } catch (err) {
      const message = toMessage(err)
      set({ loading: false, error: message })
      useToastStore.getState().push('error', `Failed to load project: ${message}`)
    } finally {
      useToastStore.getState().endInFlight()
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
      const message = toMessage(err)
      set({ project: current, error: message })
      useToastStore.getState().push('error', `Failed to save changes: ${message}`)
    }
  },
  setLocal(project) {
    set({ project })
  },
  reset() {
    set({ project: null, loading: false, error: null })
  },
}))
