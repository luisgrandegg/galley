# F-016 — Loading states and error toasts

## Goal

Replace the scattered inline `busy`/`error` patterns in the web app with a
consistent loading-and-toast surface. Per `MVP.md` Phase 6 polish, this is the
"loading states and error toasts" line item.

## Acceptance criteria

- A single toast component renders queued notifications top-right of the
  viewport. Toast kinds: `error`, `warning`, `success`, `info`. Errors are
  sticky until dismissed; the rest auto-dismiss after ~4 s.
- Every async failure surfaces as an error toast — no more silent
  `useProjectStore.error` writes that nothing reads:
  - `useProjectStore.patch` failures (currently swallowed into `state.error`).
  - `api.saveLayout` debounced failures from F-013.
  - Blueprint upload failures (`BlueprintEditor`).
  - Q&A turn failures (`QAWizard`).
  - Layout generation failures and the existing `warning` payload from
    `generateLayout` (currently rendered inline in `LayoutView`).
  - Project list/create/delete failures (`ProjectList`).
- Mutating buttons show an inline busy state (spinner or "…" suffix) while the
  request is in flight and are disabled to prevent double-submit. The
  pre-existing patterns already do this — keep them, just normalise the visual
  treatment.
- A long-running global operation (layout generation, blueprint upload) shows
  an unobtrusive top-of-page progress indicator in addition to the local
  button-level state.

## Technical notes

- Add `apps/web/src/components/Toast.tsx` (presentational) and
  `apps/web/src/store/toasts.ts` (Zustand store with `push(kind, message)` and
  `dismiss(id)`). Mount the toast container in `App.tsx`.
- Provide a small helper, e.g. `withToast(promise, { errorMessage })`, that
  wraps fetch calls and pushes an error toast on rejection. Use it from
  `useProjectStore` so `patch` errors actually reach the UI.
- Keep the toast store independent of `useProjectStore` so toasts work on the
  project list page too.
- No external toast library — Tailwind + a minimal store keeps the dependency
  count flat (the project already avoids non-essential deps).

## Out of scope

- Toast-driven undo affordances. Defer.
- Persistent error log / dev console panel.
- Optimistic-update rollback animations.

---

## Completion

- **Completed:** 2026-05-07
- **PR:** #TBD
- **Commit:** f07e005d6243ba11045652fcf037e505f764bac3
- **Notes:** Toast store (`apps/web/src/store/toasts.ts`), Toast/GlobalProgressBar
  components (`apps/web/src/components/Toast.tsx`), and `withToast` helper
  (`apps/web/src/lib/withToast.ts`) added. `useProjectStore.load`/`patch`
  failures now toast (replacing silent `state.error` writes — the `error` field
  is kept for backwards compatibility and documented as such). `ProjectList`,
  `QAWizard`, and `ProjectEditor` migrated to toasts. `BlueprintEditor` and
  `LayoutView` intentionally untouched because PRs #2 (F-008/F-010) and #3
  (F-013/F-014) are open against them; the BlueprintEditor upload failure
  toasts and the `LayoutView` validator-warning toast are deferred to a
  follow-up that lands once both PRs merge. The `GlobalProgressBar` and
  `inFlight` counter API ship in this PR (and `useProjectStore.load` is
  wired); wiring the layout-generation and blueprint-upload sites lives in
  the same follow-up.
