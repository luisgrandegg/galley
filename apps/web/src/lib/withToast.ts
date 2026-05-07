import { useToastStore } from '../store/toasts'

export type WithToastOptions = {
  /** Custom error toast message. If omitted, the rejection's message is used. */
  errorMessage?: string
  /** Optional success toast message pushed when the promise resolves. */
  successMessage?: string
  /** Increment the global in-flight counter for the duration of the promise. */
  trackInFlight?: boolean
}

/**
 * Wrap a promise so any rejection surfaces as an error toast. The original
 * rejection is re-thrown so callers can still react (e.g. keep a button busy
 * until the catch settles, or branch on success vs failure).
 *
 * Optionally pushes a success toast on resolution and/or tracks the call
 * against the global in-flight counter that drives the top-of-page progress
 * indicator.
 */
export async function withToast<T>(
  promise: Promise<T>,
  options: WithToastOptions = {},
): Promise<T> {
  const { errorMessage, successMessage, trackInFlight } = options
  const store = useToastStore.getState()
  if (trackInFlight) store.beginInFlight()
  try {
    const result = await promise
    if (successMessage) store.push('success', successMessage)
    return result
  } catch (err) {
    const fallback = err instanceof Error ? err.message : String(err)
    store.push('error', errorMessage ?? fallback)
    throw err
  } finally {
    if (trackInFlight) store.endInFlight()
  }
}
