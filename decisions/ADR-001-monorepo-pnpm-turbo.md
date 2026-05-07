# ADR-001 — pnpm workspaces + Turborepo

**Status:** Accepted
**Date:** 2026-05-07

## Context

galley is a small product but it has at least three distinct concerns that need
to share TypeScript types:

- A Vite-built React frontend (`apps/web`).
- A Hono-based Node backend (`apps/api`).
- A pure-TS module (`packages/shared`) holding the type definitions, the standard
  module library, and — critically — the deterministic layout validator.

Both apps must agree on those types and constants. The validator must be
importable from the backend (for the LLM repair loop) and the frontend (so the
UI can show validation warnings live as the user drags modules around).

We have to pick a monorepo strategy on day one because the import boundary
defines the directory layout.

## Decision

Use **pnpm workspaces** for package linking and **Turborepo** for the task
graph. Two apps under `apps/`, one shared package under `packages/shared`, all
using strict TypeScript.

## Alternatives Considered

- **Single Vite project with a `server/` folder.** Cheapest to bootstrap, but the
  validator would have to be either duplicated or carved out anyway, which is
  the actual hard problem. Punted.
- **Nx.** Heavier than the project needs. Turborepo's caching is already
  overkill for three packages.
- **Yarn / npm workspaces.** No reason to prefer them over pnpm; pnpm has
  stricter dependency hoisting which catches accidental cross-package
  dependencies earlier.

## Consequences

**Positive.**
- One source of truth for `Project`, `Wall`, `FixedPoint`, `Module`, `Preferences`,
  `Layout`, `STANDARD_MODULES`, `CLEARANCES`, `WORK_TRIANGLE`, and `validateLayout`.
- The validator runs identically on the backend (during the LLM repair loop) and
  on the frontend (live, as the user edits).
- `turbo build` gives us a single CI step for the whole repo.

**Negative.**
- Every contributor needs pnpm and Volta. The `/setup-environment` slash command
  exists to make that one-step.
- A bit more ceremony than a flat single project — but the alternative is
  copy-pasting the validator, which would diverge instantly.
