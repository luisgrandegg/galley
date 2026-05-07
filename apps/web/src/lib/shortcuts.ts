/**
 * Single source of truth for the shortcuts panel (F-017). Each entry documents
 * a binding owned by another component — this file does not register any
 * listeners itself.
 */

export type ShortcutScope = 'global' | 'editor' | 'layout'

export type ShortcutEntry = {
  keys: string[]
  scope: ShortcutScope
  description: string
}

export const SHORTCUTS: readonly ShortcutEntry[] = [
  // Global
  { keys: ['?'], scope: 'global', description: 'Open this shortcuts panel' },
  { keys: ['Esc'], scope: 'global', description: 'Close panel or cancel current tool' },
  { keys: ['Cmd/Ctrl', 'Z'], scope: 'global', description: 'Undo last edit' },
  {
    keys: ['Cmd/Ctrl', 'Shift', 'Z'],
    scope: 'global',
    description: 'Redo (also Ctrl+Y on Windows)',
  },

  // Blueprint editor
  {
    keys: ['Shift'],
    scope: 'editor',
    description: 'Hold while tracing to free-rotate (skip 5° angle snap)',
  },
  {
    keys: ['Click toolbar'],
    scope: 'editor',
    description: 'Switch between wall-trace and fixed-point modes',
  },

  // Layout view
  { keys: ['R'], scope: 'layout', description: 'Rotate selected module 90°' },
  { keys: ['Del'], scope: 'layout', description: 'Delete selected module' },
  { keys: ['Backspace'], scope: 'layout', description: 'Delete selected module' },
  {
    keys: ['Right-click'],
    scope: 'layout',
    description: 'Open swap menu for the selected module',
  },
] as const

export const SCOPE_LABELS: Record<ShortcutScope, string> = {
  global: 'Global',
  editor: 'Blueprint editor',
  layout: 'Layout view',
}
