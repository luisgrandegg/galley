# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the galley monorepo.

---

## What is an ADR?

An Architecture Decision Record documents a significant architectural choice. It captures:

- **What** was decided
- **Why** it was decided (context and forces at play)
- **What alternatives** were considered and ruled out
- **What consequences** — positive and negative — follow from the decision

ADRs are written once and never deleted. If a decision is reversed, the old ADR
is marked "Superseded" and a new ADR is written explaining the new direction.

---

## Why this project uses ADRs

galley is an MVP intended to ship fast and stay small. The risk is the opposite of
what big projects face: not over-engineering on day one, but accidentally
re-engineering on day forty when someone forgets why we picked SQLite, why we
picked Konva, or why coordinates are millimetres.

ADRs make those choices durable so the next agent or contributor can challenge
them deliberately rather than reverse them by accident.

---

## ADR Format (Nygard-style)

```markdown
# ADR-00X — Title

**Status:** Accepted | Superseded by ADR-00Y | Deprecated
**Date:** YYYY-MM-DD

## Context

What forces, constraints, or requirements led to this decision?

## Decision

What was decided? State it as a clear, direct sentence.

## Alternatives Considered

What other approaches were evaluated? Why were they rejected?

## Consequences

What are the positive and negative outcomes of this decision?
What new constraints does it create?
```

---

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [ADR-001](./ADR-001-monorepo-pnpm-turbo.md) | pnpm workspaces + Turborepo | Accepted |
| [ADR-002](./ADR-002-millimetres-as-canonical-unit.md) | Millimetres as the canonical unit | Accepted |
| [ADR-003](./ADR-003-sqlite-json-blob-per-project.md) | SQLite with one JSON blob per project | Accepted |
| [ADR-004](./ADR-004-validator-first-llm-second.md) | Validator first; LLM repairs against it | Accepted |
| [ADR-005](./ADR-005-llm-tool-calling-with-zod.md) | LLM tool-calling, Zod-validated outputs | Accepted |
| [ADR-006](./ADR-006-provider-agnostic-llm-via-ai-sdk.md) | Provider-agnostic LLM via Vercel AI SDK; default Gemini 2.5 Flash | Accepted |

---

## How to Write a New ADR

1. Pick the next number in sequence (e.g. `ADR-006`).
2. Create `decisions/ADR-006-short-title.md` using the format above.
3. Set **Status: Accepted** if it is a current decision, or **Status: Proposed** if it is under discussion.
4. Add a row to the index table in this README.
5. If it supersedes an existing ADR, update that ADR's status line to read `Superseded by ADR-006`.
6. Commit with message `docs(decisions): add ADR-006 — <title>`.

## How to Supersede an ADR

Never delete an old ADR. Instead:

1. Open the old ADR and change its `**Status:**` line to `Superseded by ADR-00X`.
2. Write the new ADR referencing the old one in its Context section.
3. Update the index table in this README.
