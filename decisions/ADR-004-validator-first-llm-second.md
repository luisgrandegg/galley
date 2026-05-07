# ADR-004 — Validator first; LLM repairs against it

**Status:** Accepted
**Date:** 2026-05-07

## Context

The most likely failure mode for galley is the LLM producing a layout that
*looks* plausible — modules placed against walls, sink near the water inlet —
but quietly violates a constraint: a fridge door that hits the dishwasher when
opened, a 700 mm walkway between opposing cabinet runs, a work triangle that
exceeds 7900 mm.

We can catch every one of those violations deterministically. The constants are
known (`CLEARANCES`, `WORK_TRIANGLE`), the geometry is simple polygon work, and
the test cases are easy to write by hand.

If we trust the LLM to police itself, we will ship a product whose primary
failure mode is silent.

## Decision

**The validator is the source of truth. The LLM is a proposer.**

1. The validator (`packages/shared/src/validator.ts`) is a pure TypeScript
   function: `validateLayout(input) -> { ok: boolean; violations: Violation[] }`.
2. It is tested with hand-crafted layouts before it is ever called from the
   backend.
3. The layout-generation endpoint runs the validator on every LLM response.
   - If `ok: true`, the layout is returned.
   - If not, the violations are sent back to the LLM as a tool result and the
     LLM is asked to repair. Cap at 3 repair iterations.
   - After 3 failed iterations, return the best-effort layout with a warning
     surfaced in the UI.
4. The frontend re-runs the validator live as the user drags modules around so
   they see violations immediately.

The validator's test suite is the most important code in this repo. UI glue does
not need tests; the validator does.

## Alternatives Considered

- **Trust the LLM, validate visually.** Rejected — silent failures.
- **Make the LLM output a constraint-satisfaction problem and solve it
  deterministically.** Probably the right end state. For an MVP, propose-and-
  validate is faster to ship and lets us see whether the LLM alone is enough.

## Consequences

**Positive.**
- A wrong layout is impossible to ship: either the LLM fixed it, or the UI
  shows a warning with concrete violations.
- The validator's test suite is the regression guard for every prompt change.
- Frontend gets free live validation during refinement.

**Negative.**
- Every new spec rule means a validator change *and* a unit test. Costly per
  rule, but cheap per bug.
- The LLM repair loop costs up to 4 calls per generation in the worst case. We
  cap at 3 retries to bound this.
