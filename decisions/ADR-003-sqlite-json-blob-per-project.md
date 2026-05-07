# ADR-003 — SQLite with one JSON blob per project

**Status:** Accepted
**Date:** 2026-05-07

## Context

A galley `Project` is a single, deeply nested aggregate: walls, fixed points,
preferences, layout. There is no cross-project query — everything is scoped to
one project at a time. The MVP is single-user and runs on a developer's laptop
or a small VPS.

We have to pick a persistence strategy on day one. The schema for `Project`
will keep changing as the LLM prompt evolves and the validator gains rules; a
relational schema would cost more than it gives us at MVP scale.

## Decision

**One row per project.** SQLite via `better-sqlite3`.

```sql
CREATE TABLE projects (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  data_json   TEXT    NOT NULL
);
```

`data_json` is a serialised `Project` excluding `id`, `name`, and `created_at`.
The full `Project` is reconstructed by merging the columns and the JSON.

Blueprint images are stored on the local filesystem at
`apps/api/uploads/<projectId>/blueprint.<ext>`, never in the database.

## Alternatives Considered

- **Postgres + Prisma.** Too heavy for an MVP that has no relational queries.
  The pain of running Postgres locally and in CI is not yet justified.
- **Normalised SQLite (one table per entity).** Would require a migration every
  time the validator gains a new rule that touches a new field. Premature.
- **Filesystem-only (one JSON file per project).** Locking and atomic writes
  become our problem. SQLite gets us those for free.

## Consequences

**Positive.**
- Schema changes are just TypeScript changes — no migrations.
- One transaction = one project save = atomic. No partial states.
- Easy to back up: copy the SQLite file and the `uploads/` folder.

**Negative.**
- No SQL queries against project internals. Fine — there is no use case for that
  in the MVP. If the product gains multi-project search later, that's a new ADR.
- We rely on Zod (or hand-written guards) to keep `data_json` consistent with
  the current TypeScript types. The validator runs on every load to catch drift.
