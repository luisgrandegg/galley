import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Per ADR-005: log every LLM request/response in dev mode. Gitignored.
// Non-negotiable when prompts misbehave.

const LOG_DIR = process.env.GALLEY_LLM_LOGS ?? 'llm-logs'
const enabled = process.env.NODE_ENV !== 'production'

if (enabled) mkdirSync(LOG_DIR, { recursive: true })

export function logLLMCall(
  kind: string,
  payload: { request: unknown; response: unknown }
): void {
  if (!enabled) return
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const path = join(LOG_DIR, `${ts}-${kind}.json`)
  writeFileSync(path, JSON.stringify(payload, null, 2))
}
