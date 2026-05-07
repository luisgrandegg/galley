import { create } from 'zustand'

export type ToastKind = 'error' | 'warning' | 'success' | 'info'

export type Toast = {
  id: string
  kind: ToastKind
  message: string
}

export type ToastOptions = {
  /** Override the default auto-dismiss duration (ms). Errors default to sticky. */
  durationMs?: number
}

type ToastState = {
  toasts: Toast[]
  /** Counter of currently in-flight long-running operations (e.g. layout gen, upload). */
  inFlight: number
  push: (kind: ToastKind, message: string, options?: ToastOptions) => string
  dismiss: (id: string) => void
  beginInFlight: () => void
  endInFlight: () => void
}

const MAX_VISIBLE = 5
const DEFAULT_AUTO_DISMISS_MS = 4000

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function clearTimer(id: string): void {
  const t = timers.get(id)
  if (t !== undefined) {
    clearTimeout(t)
    timers.delete(id)
  }
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `t_${Date.now().toString(36)}_${idCounter}`
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  inFlight: 0,
  push(kind, message, options) {
    const id = nextId()
    set((state) => {
      const next = [...state.toasts, { id, kind, message }]
      // Cap the visible list — drop oldest first.
      const overflow = next.length - MAX_VISIBLE
      if (overflow > 0) {
        for (let i = 0; i < overflow; i += 1) {
          const dropped = next[i]
          if (dropped) clearTimer(dropped.id)
        }
        return { toasts: next.slice(overflow) }
      }
      return { toasts: next }
    })

    const isSticky = kind === 'error' && options?.durationMs === undefined
    if (!isSticky) {
      const duration = options?.durationMs ?? DEFAULT_AUTO_DISMISS_MS
      const timer = setTimeout(() => {
        get().dismiss(id)
      }, duration)
      timers.set(id, timer)
    }

    return id
  },
  dismiss(id) {
    clearTimer(id)
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
  beginInFlight() {
    set((state) => ({ inFlight: state.inFlight + 1 }))
  },
  endInFlight() {
    set((state) => ({ inFlight: Math.max(0, state.inFlight - 1) }))
  },
}))
