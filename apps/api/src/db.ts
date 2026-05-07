import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Project } from '@galley/shared'

// Per ADR-003: one row per project. data_json holds everything except id, name,
// created_at — those are columns so the project list can be cheap.

const DB_PATH = process.env.GALLEY_DB ?? 'data/galley.sqlite'

mkdirSync(dirname(DB_PATH), { recursive: true })
export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    created_at  TEXT    NOT NULL,
    data_json   TEXT    NOT NULL
  );
`)

type Row = { id: string; name: string; created_at: string; data_json: string }

const insertStmt = db.prepare<[string, string, string, string]>(
  'INSERT INTO projects (id, name, created_at, data_json) VALUES (?, ?, ?, ?)'
)
const updateStmt = db.prepare<[string, string, string]>(
  'UPDATE projects SET name = ?, data_json = ? WHERE id = ?'
)
const selectStmt = db.prepare<[string]>('SELECT * FROM projects WHERE id = ?')
const listStmt = db.prepare(
  'SELECT id, name, created_at FROM projects ORDER BY created_at DESC'
)
const deleteStmt = db.prepare<[string]>('DELETE FROM projects WHERE id = ?')

export function insertProject(p: Project): void {
  const { id, name, createdAt, ...rest } = p
  insertStmt.run(id, name, createdAt, JSON.stringify(rest))
}

export function updateProject(p: Project): void {
  const { id, name, createdAt: _createdAt, ...rest } = p
  updateStmt.run(name, JSON.stringify(rest), id)
}

export function getProject(id: string): Project | null {
  const row = selectStmt.get(id) as Row | undefined
  if (!row) return null
  const rest = JSON.parse(row.data_json) as Omit<Project, 'id' | 'name' | 'createdAt'>
  return { id: row.id, name: row.name, createdAt: row.created_at, ...rest }
}

export type ProjectSummary = { id: string; name: string; createdAt: string }

export function listProjects(): ProjectSummary[] {
  const rows = listStmt.all() as Array<Pick<Row, 'id' | 'name' | 'created_at'>>
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }))
}

export function deleteProject(id: string): void {
  deleteStmt.run(id)
}
