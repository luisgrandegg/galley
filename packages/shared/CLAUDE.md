# packages/shared — context

This package is imported by both `apps/web` and `apps/api`. Anything in it must
be **pure TypeScript** — no Node-only APIs (`fs`, `path`), no DOM-only APIs
(`window`, `Image`), no React.

## Files

- `types.ts` — domain types (`Project`, `Wall`, `FixedPoint`, `Module`,
  `Preferences`, `Layout`, `Violation`).
- `constants.ts` — `STANDARD_MODULES`, `CLEARANCES`, `WORK_TRIANGLE`. Source of
  truth for both the validator and the LLM prompt.
- `geometry.ts` — small geometric primitives used by the validator.
- `validator.ts` — the deterministic layout validator. Per ADR-004, this is the
  source of truth for layout correctness.
- `schemas.ts` — Zod schemas mirroring the types. Used by `apps/api` to
  validate every LLM tool-call response (ADR-005).
- `validator.test.ts` — the only test suite that matters in this repo.

## Rules for this package

1. **No side effects in module scope.** Importing the package must not start
   timers, open files, or read globals.
2. **Adding a validator rule = adding tests.** Every check exposes its name as
   a `Violation['kind']`; if you add a kind, add at least one positive and one
   negative test. Run `/audit-validator` afterwards.
3. **Constants change = prompt change.** When `STANDARD_MODULES`, `CLEARANCES`,
   or `WORK_TRIANGLE` change, the LLM system prompt in
   `apps/api/src/llm/layout.ts` already reads them. Just confirm the prompt
   re-stringifies the new values.
4. **Never short-circuit the validator.** It must run every check and return
   *all* violations, so the LLM repair loop and the live UI both get full
   feedback.

## How the validator is consumed

- `apps/api` calls it after every LLM `propose_layout` response (repair loop).
- `apps/web` calls it live in the layout view as the user drags / rotates /
  swaps modules so violations appear immediately.

This dual use is the whole reason the validator lives here and not in either
app.
