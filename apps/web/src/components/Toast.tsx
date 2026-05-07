import { useToastStore, type Toast as ToastModel, type ToastKind } from '../store/toasts'

const KIND_BORDER: Record<ToastKind, string> = {
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  success: 'border-l-emerald-500',
  info: 'border-l-sky-500',
}

const KIND_LABEL: Record<ToastKind, string> = {
  error: 'Error',
  warning: 'Warning',
  success: 'Success',
  info: 'Info',
}

function ToastItem({ toast }: { toast: ToastModel }) {
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-80 items-start gap-3 rounded border border-line border-l-4 bg-white px-3 py-2 shadow-sm ${KIND_BORDER[toast.kind]}`}
    >
      <div className="flex-1 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {KIND_LABEL[toast.kind]}
        </div>
        <div className="mt-0.5 text-stone-800 break-words">{toast.message}</div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="rounded px-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        onClick={() => dismiss(toast.id)}
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}

/**
 * Thin top-of-page progress bar. Visible whenever `inFlight > 0`.
 * Uses an indeterminate animated stripe via Tailwind `animate-pulse`.
 */
export function GlobalProgressBar() {
  const inFlight = useToastStore((s) => s.inFlight)
  if (inFlight <= 0) return null
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-sky-100"
    >
      <div className="h-full w-1/3 animate-pulse bg-sky-500" />
    </div>
  )
}
