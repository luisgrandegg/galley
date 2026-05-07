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

---

## Completion

- **Completed:** 2026-05-07
- **PR:** #TBD
- **Commit:** 3548e396f60d853cb2e7a9491db931cae88b15c1
- **Notes:** Export buttons added to the LayoutView aside. The PNG export hides
  the selection-outline overlay layer (held on a dedicated Konva `Layer` ref)
  before calling `stage.toDataURL({ pixelRatio: 2 })`, then restores it. JSON
  export streams the full `Project` via a Blob URL. Filenames slug the project
  name and append an ISO-style timestamp with `:`/`.` replaced for cross-OS
  safety.
