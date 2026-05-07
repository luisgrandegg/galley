# F-008 — Wall tracing tool

## Goal

Let the user trace the kitchen's walls on top of the uploaded blueprint by
clicking to place vertices, with a polyline closed by double-click. Snap to 5°
angle increments by default; hold Shift to free-rotate.

## Acceptance criteria

- A "trace walls" toolbar button enters tracing mode.
- Clicking on the canvas drops a vertex; subsequent clicks extend the polyline.
- Double-click closes the polyline and emits one `Wall` per segment.
- Snap to 5° angle increments unless Shift is held.
- Wall segments persist via the existing `PUT /api/projects/:id` endpoint.
- The validator's "containment" check passes for any closed traced polygon.

## Technical notes

- All coordinates stored in mm via the `pxPerMm` conversion.
- Wall thickness defaults to 100 mm.
- Tracing UI lives in `apps/web/src/components/editor/WallTraceTool.tsx`.

## Out of scope

- Wall editing (split, merge, delete). Defer to a follow-up.
- Curved walls. Polylines only.

---

## Completion

- **Completed:** 2026-05-07
- **PR:** [#2](https://github.com/luisgrandegg/galley/pull/2) — feat: wall tracing tool and fixed-point placement (F-008, F-010)
- **Commit:** 8e808cf223ad86d71b3c91b3f77a97c1514f222a
- **Notes:** WallTraceTool is presentational + imperative (ref) so the editor
  owns the Stage and dispatches click/dblclick. Vertices are stored in mm
  via `pxToMm`; closed polyline emits one Wall per consecutive pair with
  `DEFAULT_WALL_THICKNESS`. Shift bypasses 5° snapping. Esc exits the mode.
