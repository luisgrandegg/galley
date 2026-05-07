import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { mkdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import {
  ModuleSchema,
  PreferencesSchema,
  type FixedPoint,
  type Module,
  type Project,
  type Wall,
} from '@galley/shared'
import {
  deleteProject,
  getProject,
  insertProject,
  listProjects,
  updateProject,
} from './db.js'
import { nextQATurn, type QAMessage } from './llm/qa.js'
import { generateLayout } from './llm/layout.js'
import { MissingApiKeyError } from './llm/provider.js'

const UPLOADS = process.env.GALLEY_UPLOADS ?? 'uploads'
mkdirSync(UPLOADS, { recursive: true })

const app = new Hono()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
)

app.get('/api/health', (c) => c.json({ ok: true }))

// ── Projects CRUD ──────────────────────────────────────────────────────────

app.get('/api/projects', (c) => c.json({ data: listProjects() }))

const CreateProjectBody = z.object({ name: z.string().min(1).max(120) })

app.post('/api/projects', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = CreateProjectBody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { code: 'invalid_body', message: parsed.error.message } }, 400)
  }
  const project: Project = {
    id: nanoid(10),
    name: parsed.data.name,
    createdAt: new Date().toISOString(),
    blueprint: null,
    scale: null,
    walls: [],
    fixedPoints: [],
    preferences: null,
    layout: null,
  }
  insertProject(project)
  return c.json({ data: project }, 201)
})

app.get('/api/projects/:id', (c) => {
  const project = getProject(c.req.param('id'))
  if (!project) return c.json({ error: { code: 'not_found', message: 'Project not found' } }, 404)
  return c.json({ data: project })
})

const UpdateProjectBody = z.object({
  name: z.string().min(1).max(120).optional(),
  walls: z.array(z.unknown()).optional(),
  fixedPoints: z.array(z.unknown()).optional(),
  scale: z.object({ pxPerMm: z.number().positive() }).nullable().optional(),
  preferences: PreferencesSchema.nullable().optional(),
})

app.put('/api/projects/:id', async (c) => {
  const id = c.req.param('id')
  const project = getProject(id)
  if (!project) return c.json({ error: { code: 'not_found', message: 'Project not found' } }, 404)
  const body = await c.req.json().catch(() => null)
  const parsed = UpdateProjectBody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { code: 'invalid_body', message: parsed.error.message } }, 400)
  }
  const next: Project = {
    ...project,
    name: parsed.data.name ?? project.name,
    walls: (parsed.data.walls as Wall[] | undefined) ?? project.walls,
    fixedPoints:
      (parsed.data.fixedPoints as FixedPoint[] | undefined) ?? project.fixedPoints,
    scale: parsed.data.scale === undefined ? project.scale : parsed.data.scale,
    preferences:
      parsed.data.preferences === undefined ? project.preferences : parsed.data.preferences,
  }
  updateProject(next)
  return c.json({ data: next })
})

app.delete('/api/projects/:id', (c) => {
  deleteProject(c.req.param('id'))
  return c.json({ data: { ok: true } })
})

// ── Blueprint upload ───────────────────────────────────────────────────────

app.post('/api/projects/:id/blueprint', async (c) => {
  const id = c.req.param('id')
  const project = getProject(id)
  if (!project) return c.json({ error: { code: 'not_found', message: 'Project not found' } }, 404)

  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return c.json({ error: { code: 'invalid_body', message: 'Expected multipart file' } }, 400)
  }
  const widthPxRaw = form?.get('widthPx')
  const heightPxRaw = form?.get('heightPx')
  const widthPx = Number(widthPxRaw)
  const heightPx = Number(heightPxRaw)
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx)) {
    return c.json(
      { error: { code: 'invalid_body', message: 'widthPx and heightPx are required' } },
      400
    )
  }

  const ext = extname(file.name) || '.png'
  const filename = `blueprint${ext}`
  const dir = join(UPLOADS, id)
  mkdirSync(dir, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  writeFileSync(join(dir, filename), buffer)

  const next: Project = {
    ...project,
    blueprint: { filename, widthPx, heightPx },
  }
  updateProject(next)
  return c.json({ data: next })
})

app.get('/api/projects/:id/blueprint', async (c) => {
  const id = c.req.param('id')
  const project = getProject(id)
  if (!project || !project.blueprint) {
    return c.json({ error: { code: 'not_found', message: 'No blueprint' } }, 404)
  }
  const path = join(UPLOADS, id, project.blueprint.filename)
  const { readFileSync } = await import('node:fs')
  const data = readFileSync(path)
  const ext = project.blueprint.filename.split('.').pop()?.toLowerCase()
  const contentType =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'png'
        ? 'image/png'
        : 'application/octet-stream'
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: { 'content-type': contentType },
  })
})

// ── Q&A ────────────────────────────────────────────────────────────────────

const QABody = z.object({
  partial: z.record(z.unknown()).default({}),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .default([]),
})

app.post('/api/projects/:id/qa/next', async (c) => {
  const id = c.req.param('id')
  const project = getProject(id)
  if (!project) return c.json({ error: { code: 'not_found', message: 'Project not found' } }, 404)

  const body = await c.req.json().catch(() => null)
  const parsed = QABody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { code: 'invalid_body', message: parsed.error.message } }, 400)
  }

  try {
    const turn = await nextQATurn({
      partial: parsed.data.partial as Record<string, unknown>,
      history: parsed.data.history as QAMessage[],
    })
    if (turn.kind === 'final') {
      const next: Project = { ...project, preferences: turn.preferences }
      updateProject(next)
    }
    return c.json({ data: turn })
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return c.json({ error: { code: 'no_api_key', message: err.message } }, 503)
    }
    const message = err instanceof Error ? err.message : 'unknown'
    return c.json({ error: { code: 'llm_error', message } }, 500)
  }
})

// ── Layout generation ─────────────────────────────────────────────────────

app.post('/api/projects/:id/layout/generate', async (c) => {
  const id = c.req.param('id')
  const project = getProject(id)
  if (!project) return c.json({ error: { code: 'not_found', message: 'Project not found' } }, 404)
  if (!project.preferences) {
    return c.json(
      { error: { code: 'precondition', message: 'Complete the Q&A first' } },
      412
    )
  }
  if (project.walls.length === 0) {
    return c.json({ error: { code: 'precondition', message: 'Trace walls first' } }, 412)
  }

  try {
    const result = await generateLayout({
      walls: project.walls,
      fixedPoints: project.fixedPoints,
      preferences: project.preferences,
    })
    const next: Project = { ...project, layout: result.layout }
    updateProject(next)
    return c.json({
      data: {
        layout: result.layout,
        validation: result.validation,
        repairIterations: result.repairIterations,
        warning: result.warning,
      },
    })
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return c.json({ error: { code: 'no_api_key', message: err.message } }, 503)
    }
    const message = err instanceof Error ? err.message : 'unknown'
    return c.json({ error: { code: 'llm_error', message } }, 500)
  }
})

// ── Manual layout save (for refinement persistence) ───────────────────────

app.put('/api/projects/:id/layout', async (c) => {
  const id = c.req.param('id')
  const project = getProject(id)
  if (!project) return c.json({ error: { code: 'not_found', message: 'Project not found' } }, 404)
  const body = await c.req.json().catch(() => null)
  const parsed = z
    .object({
      modules: z.array(ModuleSchema),
      rationale: z.string(),
      generatedAt: z.string(),
    })
    .safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { code: 'invalid_body', message: parsed.error.message } }, 400)
  }
  const next: Project = {
    ...project,
    layout: {
      modules: parsed.data.modules satisfies Module[],
      rationale: parsed.data.rationale,
      generatedAt: parsed.data.generatedAt,
    },
  }
  updateProject(next)
  return c.json({ data: next })
})

// ── Boot ───────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3001)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[galley/api] listening on http://localhost:${info.port}`)
})
