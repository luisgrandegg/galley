# F-015 — Undo/redo in-session stack

## Goal

Let the user undo and redo destructive or hard-to-reverse edits within a single
session. Per `MVP.md`, scope is explicitly "a simple in-session stack" — no
persistence across reloads, no per-field granularity.

## Acceptance criteria

- `Cmd/Ctrl+Z` undoes the last meaningful edit; `Cmd/Ctrl+Shift+Z` (and `Ctrl+Y`
  on Windows) redoes it.
- Undo and redo buttons appear in the project header, disabled when the
  respective stack is empty.
- The stack covers at minimum:
  - Wall segments added (F-008).
  - Fixed points added, moved, or removed (F-010).
  - Module drag, rotate, swap, and delete (F-013).
  - Layout regeneration (treat the prior layout as one undo step).
- Stack is bounded to ~50 entries; oldest entries drop silently.
- Stack is cleared on navigation away from the project (`useProjectStore.reset`).
- A new branch of edits after an undo discards the redo stack (standard
  history-tree behaviour — no fancy branching).
- Shortcuts are ignored while focus is in an `<input>`, `<textarea>`, or
  `contenteditable` element.

## Technical notes

- Snapshot-based, not operation-based: push the prior `Project` JSON onto the
  undo stack before each meaningful mutation. The `Project` shape is small —
  this is fine for MVP and keeps the implementation trivial.
- Add the stacks and `undo()`/`redo()` actions to `apps/web/src/store.ts`.
  Wrap the existing `patch` and `setLocal` paths so every meaningful mutation
  pushes a snapshot. Drag ticks must NOT push — only the debounced/dragend
  commits already used by F-013 should.
- Persist the post-undo/redo state via `api.updateProject` (or `saveLayout` for
  layout-only changes) so the backend stays in sync.
- The Q&A wizard's preferences are mid-flow state. Do not put intermediate Q&A
  turns on the stack; only the `final` preferences commit counts.

## Out of scope

- Cross-session history. A page reload starts a fresh stack.
- Per-field undo (e.g. undoing a single character of a label). The unit is the
  `Project` snapshot.
- Undo/redo of the blueprint image upload — too heavy and unlikely needed.

---

## Completion

- **Date:** 2026-05-07
- **PR:** #TBD
- **Commit:** 95d21a8
- **Notes:** Implemented entirely at the `useProjectStore` layer so any
  mutation through `patch` or `setLocal` is snapshotted automatically. Bounded
  to 50 entries; both stacks reset in `load()` and `reset()`. New mutations
  after an undo clear the future stack. Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y
  bindings live in `ProjectEditor.tsx` and skip when focus is in an editable
  target via `apps/web/src/lib/keyboard.ts`. Header has Undo/Redo buttons that
  disable when the matching stack is empty. `setLocal` accepts an optional
  `{ snapshot: false }` so debounced server-roundtrip writes (the F-013
  pattern) can skip duplicate snapshots once that PR merges; structural-equality
  dedupe also covers the no-op case. Per coordinator brief,
  `BlueprintEditor.tsx` and `LayoutView.tsx` remain untouched — F-008/F-010/F-013
  mutations are picked up automatically once their PRs land.
