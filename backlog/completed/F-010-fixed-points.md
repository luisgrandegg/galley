# F-010 — Fixed-point placement tool

## Goal

Let the user mark fixed-point services on the blueprint: water inlet, drain,
gas inlet, electrical outlets, doors (with swing direction), windows.

## Acceptance criteria

- Toolbar exposes one button per `FixedPoint.kind`.
- Clicking on the canvas drops a fixed point at the click position (in mm).
- Doors prompt for `width` and `swing` ("left" | "right" | "none").
- Windows prompt for `width`.
- Fixed points are draggable to refine position.
- Persisted via `PUT /api/projects/:id`.

## Technical notes

- Each kind has a distinct icon/colour (consistent palette).
- The validator's "fixed-point alignment" and "door swing clear" checks both
  read these.
- Component: `apps/web/src/components/editor/FixedPointTool.tsx`.

## Out of scope

- Editing properties after placement (other than position drag). Defer.

---

## Completion

- **Completed:** 2026-05-07
- **PR:** [#2](https://github.com/luisgrandegg/galley/pull/2) — feat: wall tracing tool and fixed-point placement (F-008, F-010)
- **Commit:** 8e808cf223ad86d71b3c91b3f77a97c1514f222a
- **Notes:** FixedPointTool ships one toolbar button per `FixedPointKind`
  with a consistent palette. Doors and windows use `window.prompt` for
  width and (for doors) swing — acceptable per MVP scope. Markers are
  draggable while the editor is idle and persist on dragend through
  `useProjectStore.patch`.
