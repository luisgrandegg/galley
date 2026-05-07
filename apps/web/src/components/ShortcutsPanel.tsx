import { useEffect } from 'react'
import { useShortcutsPanel } from '../store/shortcutsPanel'
import { SCOPE_LABELS, SHORTCUTS, type ShortcutScope } from '../lib/shortcuts'

const SCOPE_ORDER: ShortcutScope[] = ['global', 'editor', 'layout']

export function ShortcutsPanel() {
  const isOpen = useShortcutsPanel((s) => s.isOpen)
  const close = useShortcutsPanel((s) => s.close)

  useEffect(() => {
    if (!isOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={close}
      role="presentation"
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded border border-line bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close shortcuts panel"
            className="text-sm text-stone-500 hover:underline"
          >
            Close
          </button>
        </header>

        <div className="mt-4 space-y-5">
          {SCOPE_ORDER.map((scope) => {
            const entries = SHORTCUTS.filter((s) => s.scope === scope)
            if (entries.length === 0) return null
            return (
              <section key={scope}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {SCOPE_LABELS[scope]}
                </h3>
                <ul className="mt-2 space-y-2">
                  {entries.map((entry, i) => (
                    <li
                      key={`${scope}-${i}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-stone-700">{entry.description}</span>
                      <span className="flex flex-wrap items-center gap-1">
                        {entry.keys.map((k, j) => (
                          <kbd
                            key={j}
                            className="rounded border border-line bg-stone-100 px-1.5 py-0.5 text-xs font-mono"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
