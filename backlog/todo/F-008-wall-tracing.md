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
