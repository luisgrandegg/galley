# /discover

Explore galley's architecture, running state, and UI — and produce a structured
discovery report.

---

## Arguments

```
/discover [free-text query]
```

`[free-text query]` — optional. What to look for. If omitted, explore broadly.

---

## What to do

### Step 1 — Load context

Read in parallel (skip gracefully if missing):

1. `MVP.md` — the product spec (source of truth)
2. `CLAUDE.md` — repo-wide rules
3. `decisions/` — every ADR
4. `apps/api/package.json`, `apps/web/package.json`, `packages/shared/package.json`
5. `backlog/backlog.md` — current state
6. Any area-scoped `CLAUDE.md` (`apps/web/CLAUDE.md`, etc.)

### Step 2 — Determine discovery scope

#### If `QUERY` is provided

Examples:

- "validator" → read `packages/shared/src/validator.ts` and its tests.
- "Q&A flow" → read `apps/api/src/llm/qa.ts`, the route, and the wizard UI.
- "data model" → read `packages/shared/src/types.ts` and the SQLite schema.
- "canvas" → read every file in `apps/web/src/components/editor/`.

#### If `QUERY` is empty

Run a broad free exploration:

1. List all routes (Glob `apps/api/src/routes/**/*.ts`).
2. List all React components (Glob `apps/web/src/**/*.tsx`).
3. Read the SQLite schema/migrations.
4. List the validator's checks (functions in `packages/shared/src/validator.ts`).
5. Read `backlog/backlog.md`.
6. Search for `TODO`, `FIXME`, `MOCK`, `HACK`.

### Step 3 — Static code exploration

Use Read, Grep, Glob to follow the code. Collect:

- **Architecture** — how `web`, `api`, and `shared` interact.
- **Data** — `Project`, `Wall`, `FixedPoint`, `Module`, `Preferences`, `Layout`.
- **API surface** — which Hono routes exist, what they accept and return.
- **UI flow** — Project list → Editor → Q&A → Layout → Refinement → Export.
- **Gaps / TODOs** — stubbed implementations, mock data, FIXMEs.

### Step 4 — Decide whether UI exploration is needed

UI exploration via Playwright is warranted when:

- `QUERY` mentions something visual.
- The static code alone cannot answer the question.

If needed, announce before starting the dev server:

```
> **Action needed:** I'm about to start the dev server (web on 5173, api on 3001).
> Make sure those ports are free. I'll stop the servers when done.
```

Wait for confirmation. Then `pnpm dev` in the background, wait ~5 seconds,
explore via Playwright if available, stop the server when done.

If Playwright is not available, ask the user to share screenshots manually.

### Step 5 — Produce the discovery report

```markdown
## Discovery Report — galley

**Date:** <today>
**Query:** <QUERY or "free exploration">

---

### Overview
<2–4 sentences: maturity vs MVP.md>

### Architecture
<How web/api/shared interact, validator placement, LLM integration model>

### Data Model
<Entities and relations from packages/shared/src/types.ts>

### API Surface
<Hono routes with method, path, body shape>

### UI Routes / Flow
<Project list, editor (image, walls, scale, fixed points), Q&A, layout, refinement>

### Validator Coverage
<Which spec checks are implemented; which are missing>

### Current State
<Which backlog items are done vs Planned>

### Gaps & TODOs
<Stubbed implementations, MOCK data, FIXME comments>

### Spec Alignment
<How well the codebase matches MVP.md; flag anything outside MVP scope>
```

If the discovery focused on a `QUERY`, add:

```markdown
### Answer to: "<QUERY>"
<Direct answer, with file references and line numbers>
```

### Step 6 — Offer next steps

Suggest 1–3 follow-up actions (e.g. "F-013 is Planned — run `/tackle-backlog`",
"the validator is missing the door-swing check — open a fix branch").
