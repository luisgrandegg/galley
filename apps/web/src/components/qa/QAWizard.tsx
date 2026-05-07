import { useState } from 'react'
import { useProjectStore } from '../../store'
import { api } from '../../lib/api'
import { withToast } from '../../lib/withToast'
import type { Preferences } from '@galley/shared'

type Turn =
  | { kind: 'question'; text: string; quickPicks?: string[] }
  | { kind: 'final'; preferences: Preferences }

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export function QAWizard() {
  const project = useProjectStore((s) => s.project)
  const setLocal = useProjectStore((s) => s.setLocal)
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [current, setCurrent] = useState<Turn | null>(null)
  const [partial, setPartial] = useState<Partial<Preferences>>({})
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  if (!project) return null

  async function nextTurn(answer?: string) {
    if (!project) return
    setBusy(true)
    try {
      const nextHistory: ChatMessage[] = answer
        ? [...history, { role: 'user', content: answer }]
        : history
      const turn = await withToast(api.qaNext(project.id, partial, nextHistory), {
        errorMessage: 'Q&A turn failed',
      })
      setHistory(
        turn.kind === 'question'
          ? [...nextHistory, { role: 'assistant', content: turn.text }]
          : nextHistory
      )
      setCurrent(turn)
      if (turn.kind === 'final') {
        setLocal({ ...project, preferences: turn.preferences })
      }
    } catch {
      // toast already pushed by withToast.
    } finally {
      setBusy(false)
    }
  }

  function answer(value: string) {
    setInput('')
    setPartial((p) => ({ ...p, notes: [p.notes, value].filter(Boolean).join(' / ') }))
    void nextTurn(value)
  }

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <div className="rounded border border-line bg-white p-4 space-y-4 min-h-[420px]">
        {history.length === 0 && !current && (
          <div className="text-sm text-stone-500 space-y-2">
            <p>The Q&A is a chat-style flow that fills in your kitchen preferences.</p>
            <button
              className="rounded bg-ink px-3 py-2 text-sm text-bone disabled:opacity-50"
              onClick={() => void nextTurn()}
              disabled={busy}
            >
              {busy ? 'Starting…' : 'Start Q&A'}
            </button>
          </div>
        )}

        {history.map((m, i) => (
          <div
            key={i}
            className={`rounded px-3 py-2 text-sm ${
              m.role === 'assistant' ? 'bg-stone-100' : 'bg-ink text-bone ml-auto w-fit'
            }`}
          >
            {m.content}
          </div>
        ))}

        {current?.kind === 'question' && current.quickPicks && (
          <div className="flex flex-wrap gap-2">
            {current.quickPicks.map((q) => (
              <button
                key={q}
                className="rounded border border-line bg-white px-3 py-1 text-sm hover:bg-stone-50"
                onClick={() => answer(q)}
                disabled={busy}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {current?.kind === 'question' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!input.trim()) return
              answer(input.trim())
            }}
            className="flex gap-2"
          >
            <input
              className="flex-1 rounded border border-line px-3 py-2 text-sm"
              placeholder="Your answer…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button
              className="rounded bg-ink px-4 py-2 text-sm text-bone disabled:opacity-50"
              type="submit"
              disabled={busy || !input.trim()}
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </form>
        )}

        {current?.kind === 'final' && (
          <div className="rounded bg-emerald-50 px-3 py-2 text-sm">
            Preferences captured. Switch to the Layout tab to generate.
          </div>
        )}
      </div>

      <aside className="rounded border border-line bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Preferences
        </h2>
        <pre className="mt-2 whitespace-pre-wrap text-xs text-stone-700">
          {JSON.stringify(project.preferences ?? partial, null, 2)}
        </pre>
      </aside>
    </div>
  )
}
