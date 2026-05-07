import { create } from 'zustand'
import type { Project } from '@galley/shared'
import { api } from './lib/api'

const MAX_HISTORY = 50

type SetLocalOptions = {
  /**
   * When true (the default), pushes the current project onto the undo stack
   * before applying the new state. F-013-style server-roundtrip writes that
   * just acknowledge an already-applied optimistic update should pass
   * `snapshot: false` to avoid recording a duplicate entry.
   */
  snapshot?: boolean
}

type State = {
  project: Project | null
  loading: boolean
  error: string | null
  pastStack: Project[]
  futureStack: Project[]
  load: (id: string) => Promise<void>
  patch: (patch: Partial<Project>) => Promise<void>
  setLocal: (project: Project, options?: SetLocalOptions) => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  reset: () => void
}

function clone(project: Project): Project {
  // Project is a JSON-serialisable shape (per types.ts); JSON deep-clone is
  // sufficient and avoids structuredClone availability concerns in older test
  // runners.
  return JSON.parse(JSON.stringify(project)) as Project
}

function pushBounded(stack: Project[], snapshot: Project): Project[] {
  const next = [...stack, snapshot]
  if (next.length > MAX_HISTORY) next.shift()
  return next
}

function isSameProject(a: Project | null, b: Project | null): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

export const useProjectStore = create<State>((set, get) => ({
  project: null,
  loading: false,
  error: null,
  pastStack: [],
  futureStack: [],
  async load(id) {
    set({ loading: true, error: null, pastStack: [], futureStack: [] })
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
    if (isSameProject(current, optimistic)) {
      // Nothing changed — don't pollute history.
      set({ project: optimistic })
      return
    }
    set({
      project: optimistic,
      pastStack: pushBounded(get().pastStack, clone(current)),
      futureStack: [],
    })
    try {
      const next = await api.updateProject(current.id, patch)
      set({ project: next })
    } catch (err) {
      // Roll back the optimistic state AND the snapshot we just pushed.
      const past = get().pastStack
      set({
        project: current,
        pastStack: past.slice(0, -1),
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },
  setLocal(project, options) {
    const snapshot = options?.snapshot ?? true
    const current = get().project
    if (!snapshot || isSameProject(current, project)) {
      set({ project })
      return
    }
    if (!current) {
      // No current project to snapshot; just adopt the new one.
      set({ project })
      return
    }
    set({
      project,
      pastStack: pushBounded(get().pastStack, clone(current)),
      futureStack: [],
    })
  },
  async undo() {
    const { pastStack, futureStack, project } = get()
    const previous = pastStack[pastStack.length - 1]
    if (!previous || !project) return
    set({
      project: previous,
      pastStack: pastStack.slice(0, -1),
      futureStack: pushBounded(futureStack, clone(project)),
    })
    try {
      await api.updateProject(project.id, previous)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },
  async redo() {
    const { pastStack, futureStack, project } = get()
    const next = futureStack[futureStack.length - 1]
    if (!next || !project) return
    set({
      project: next,
      pastStack: pushBounded(pastStack, clone(project)),
      futureStack: futureStack.slice(0, -1),
    })
    try {
      await api.updateProject(project.id, next)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },
  reset() {
    set({ project: null, loading: false, error: null, pastStack: [], futureStack: [] })
  },
}))
