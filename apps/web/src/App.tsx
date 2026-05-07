import { useEffect, useState } from 'react'
import { ProjectList } from './pages/ProjectList'
import { ProjectEditor } from './pages/ProjectEditor'
import { ShortcutsPanel } from './components/ShortcutsPanel'
import { useShortcutsPanel } from './store/shortcutsPanel'
import { isEditableTarget } from './lib/keyboard'
import { GlobalProgressBar, ToastContainer } from './components/Toast'

function parseRoute(): { kind: 'list' } | { kind: 'project'; id: string } {
  const hash = window.location.hash.slice(1)
  if (hash.startsWith('/projects/')) return { kind: 'project', id: hash.slice('/projects/'.length) }
  return { kind: 'list' }
}

export function App() {
  const [route, setRoute] = useState(parseRoute)
  const openShortcuts = useShortcutsPanel((s) => s.open)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return
      // `?` is Shift+/ on most layouts. Match either the literal '?' or
      // shift-slash to be safe across keyboards.
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        if (event.metaKey || event.ctrlKey || event.altKey) return
        event.preventDefault()
        openShortcuts()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openShortcuts])

  return (
    <div className="min-h-full">
      <GlobalProgressBar />
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <a href="#/" className="font-semibold tracking-tight">
            galley
          </a>
          <span className="text-sm text-stone-500">kitchen designer</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {route.kind === 'list' ? <ProjectList /> : <ProjectEditor id={route.id} />}
      </main>
      <ShortcutsPanel />
      <ToastContainer />
    </div>
  )
}
