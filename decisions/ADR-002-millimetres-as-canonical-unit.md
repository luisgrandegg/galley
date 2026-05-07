# ADR-002 — Millimetres as the canonical unit

**Status:** Accepted
**Date:** 2026-05-07

## Context

galley deals with three different coordinate spaces:

1. **Pixels** — what Konva actually renders, what the uploaded blueprint image is
   measured in.
2. **Millimetres** — the real-world dimensions the user cares about (cabinets,
   clearances, work-triangle limits).
3. **A user-supplied scale** — `pxPerMm`, derived from a single reference
   measurement the user enters.

Mixing the three is the single most likely source of bugs in this app. The
European 60 cm modular system, the 900 mm walkway clearance, and the work
triangle limits are all expressed in mm. The validator's correctness depends on
all comparisons happening in the same unit.

## Decision

**Millimetres are the canonical unit. Pixels are a render-time concern only.**

- Every `Wall`, `FixedPoint`, `Module` field on disk and in memory is mm.
- `STANDARD_MODULES`, `CLEARANCES`, `WORK_TRIANGLE` are mm.
- The validator operates entirely in mm.
- `pxPerMm` is stored on the project. The web app multiplies by it at render
  time and divides by it when receiving canvas events. Conversion happens at the
  Konva boundary and nowhere else.
- Origin: top-left of the bounding box of the traced walls. +x right, +y down.
  This matches Konva's screen frame so the conversion is a pure scalar multiply.

## Alternatives Considered

- **Store pixels and convert to mm only when the validator runs.** Rejected
  because every save would lose precision, and changing the scale after the
  fact would silently move every saved point.
- **Store both and keep them in sync.** Two sources of truth = one bug.

## Consequences

**Positive.**
- Validator and LLM both reason about real-world distances directly, no
  conversion gymnastics.
- Re-setting the scale after the fact only changes the display, not the data.
- Matches how real architectural software works — engineers expect this.

**Negative.**
- All canvas event handlers must convert px → mm. We codify this in a single
  helper rather than scattering `/ pxPerMm` calls. See `apps/web/src/lib/coords.ts`.
- The first mm value the user sees is the scale-setting input. The UI must make
  it obvious what unit is expected.
