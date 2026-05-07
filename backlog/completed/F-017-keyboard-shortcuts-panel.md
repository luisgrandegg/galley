# F-017 — Keyboard shortcuts panel

## Goal

Make the keyboard shortcuts introduced across F-008, F-010, F-013, and F-015
discoverable through a single in-app reference panel. Per `MVP.md` Phase 6
polish, this is the "keyboard shortcuts panel" line item.

## Acceptance criteria

- Pressing `?` (or `Shift+/`) opens a modal panel listing every shortcut.
- A "Shortcuts" button in the project header also opens the panel.
- Pressing `Esc` (or clicking the backdrop) closes the panel.
- Shortcuts are grouped by scope: Global, Blueprint editor, Layout view.
- Each entry shows the key combination (rendered as `<kbd>` chips) and a short
  description.
- The panel covers, at minimum, the bindings shipped to date:
  - **Global:** `?` open shortcuts, `Esc` close panel / cancel current tool,
    `Cmd/Ctrl+Z` undo, `Cmd/Ctrl+Shift+Z` redo (from F-015).
  - **Blueprint editor:** `Shift` (held) free-rotate while tracing walls
    (F-008), click toolbar buttons to enter wall-trace or fixed-point modes
    (F-008/F-010).
  - **Layout view:** `R` rotate selected module 90° (F-013), `Del`/`Backspace`
    delete selected module (F-013), right-click swap to alternate width
    (F-013).
- The `?` shortcut is suppressed while focus is in an `<input>`, `<textarea>`,
  or `contenteditable`.

## Technical notes

- One source of truth: `apps/web/src/lib/shortcuts.ts` exports a typed list of
  shortcut entries (`{ keys: string[]; scope: 'global' | 'editor' | 'layout';
  description: string }`). The panel renders from this list.
- The panel is a presentational component
  (`apps/web/src/components/ShortcutsPanel.tsx`) plus a tiny boolean store (or
  `useState` lifted to `App.tsx`). No router-level state needed.
- Do not attempt to centrally bind the shortcuts here — the existing components
  (F-008/F-010/F-013/F-015) own their own listeners. This feature only
  documents them. If a future refactor consolidates registration, this file
  becomes the registry.

## Out of scope

- User-customisable bindings.
- Cheat-sheet PDF/print view.
- Centralised shortcut registration / conflict detection. Each component still
  owns its own `keydown` listener; this feature only adds documentation.

---

## Completion

- **Date:** 2026-05-07
- **PR:** #TBD
- **Commit:** 95d21a8
- **Notes:** Typed shortcut registry in `apps/web/src/lib/shortcuts.ts` drives a
  presentational `ShortcutsPanel.tsx` modal mounted globally in `App.tsx`. The
  panel groups entries by scope (Global / Blueprint editor / Layout view) and
  renders each key as a `<kbd>` chip. A small Zustand store
  (`apps/web/src/store/shortcutsPanel.ts`) holds open/close state. The `?`
  global listener (in `App.tsx`) and `Esc`/backdrop close are wired; both
  respect the editable-target predicate from `apps/web/src/lib/keyboard.ts`.
  Header gains a Shortcuts button alongside Undo/Redo. Blueprint-editor and
  layout-view rows describe the bindings owned by F-008/F-010/F-013 — once
  those PRs merge, the listed behaviours match reality.
