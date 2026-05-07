# F-014 — PNG and JSON export

## Goal

Let the user export the final layout as a PNG and the full project as a JSON
snapshot.

## Acceptance criteria

- "Export PNG" button calls Konva `stage.toDataURL()` and triggers a download.
- "Export JSON" button serialises the full `Project` and triggers a download.
- Filenames use the project name and a timestamp.
- JSON export is a complete round-trip — re-importing it produces the same
  rendered state.

## Technical notes

- PNG should include modules and walls but not the editor UI chrome (toolbars,
  selection rectangles, snap guides).

## Out of scope

- PDF export. SVG export. Defer.
