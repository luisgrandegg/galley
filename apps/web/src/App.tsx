import { useEffect, useState } from 'react'
import { ProjectList } from './pages/ProjectList'
import { ProjectEditor } from './pages/ProjectEditor'

function parseRoute(): { kind: 'list' } | { kind: 'project'; id: string } {
  const hash = window.location.hash.slice(1)
  if (hash.startsWith('/projects/')) return { kind: 'project', id: hash.slice('/projects/'.length) }
  return { kind: 'list' }
}

export function App() {
  const [route, setRoute] = useState(parseRoute)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="min-h-full">
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
    </div>
  )
}
