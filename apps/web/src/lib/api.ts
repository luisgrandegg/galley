import type { Layout, Preferences, Project, ValidatorResult } from '@galley/shared'

const BASE = '/api'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { message?: string } }
  if (!res.ok) {
    throw new Error(json.error?.message ?? `${res.status} ${res.statusText}`)
  }
  return json.data as T
}

export type ProjectSummary = { id: string; name: string; createdAt: string }

export const api = {
  listProjects: () => http<ProjectSummary[]>('/projects'),
  createProject: (name: string) =>
    http<Project>('/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  getProject: (id: string) => http<Project>(`/projects/${id}`),
  updateProject: (id: string, patch: Partial<Project>) =>
    http<Project>(`/projects/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  deleteProject: (id: string) =>
    http<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  uploadBlueprint: (id: string, file: File, widthPx: number, heightPx: number) => {
    const form = new FormData()
    form.set('file', file)
    form.set('widthPx', String(widthPx))
    form.set('heightPx', String(heightPx))
    return http<Project>(`/projects/${id}/blueprint`, { method: 'POST', body: form })
  },
  blueprintUrl: (id: string) => `${BASE}/projects/${id}/blueprint`,
  qaNext: (id: string, partial: Partial<Preferences>, history: { role: 'user' | 'assistant'; content: string }[]) =>
    http<
      | { kind: 'question'; text: string; quickPicks?: string[] }
      | { kind: 'final'; preferences: Preferences }
    >(`/projects/${id}/qa/next`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ partial, history }),
    }),
  generateLayout: (id: string) =>
    http<{
      layout: Layout
      validation: ValidatorResult
      repairIterations: number
      warning: string | null
    }>(`/projects/${id}/layout/generate`, { method: 'POST' }),
  saveLayout: (id: string, layout: Layout) =>
    http<Project>(`/projects/${id}/layout`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(layout),
    }),
}
