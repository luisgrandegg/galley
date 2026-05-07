/**
 * Returns true when the keyboard event originated from a text-editing context
 * (input, textarea, or contenteditable). Shortcut listeners should bail when
 * this is true so the user can type freely.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}
