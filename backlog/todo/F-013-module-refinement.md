# F-013 — Module drag / rotate / swap / delete + snap

## Goal

Let the user refine a generated layout by manipulating modules on the canvas.

## Acceptance criteria

- Modules are draggable; positions update in mm.
- `R` rotates the selected module by 90° (rotation values 0/90/180/270 only).
- `Del` / `Backspace` deletes the selected module.
- Right-click opens a "swap to ___" menu listing widths from `STANDARD_MODULES`
  for the same `kind`.
- Drag-snap: module edges snap to wall edges within 30 mm and to other module
  edges within 10 mm.
- The validator runs live and surfaces violations in a sidebar.

## Technical notes

- Live validator runs from `packages/shared/src/validator.ts` directly in the
  browser (it is pure TS).
- Snap helpers live in `apps/web/src/lib/snap.ts`.

## Out of scope

- Free rotation. 90° increments only in MVP.
- Multi-select. Defer.
