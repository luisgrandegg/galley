# CLAUDE.md — galley

> This file is automatically read by Claude Code at session start.
> It provides full project context so every session begins with shared understanding.
> **Read this before doing anything else.**

---

## Product Spec

**Read [`MVP.md`](./MVP.md) before anything else.** It is the source of truth for
what galley is: a kitchen designer where a user uploads a blueprint, traces walls,
answers an AI-driven Q&A, and receives a 2D top-down kitchen layout that they can
refine on a Konva canvas.

Every feature, data-model, and technical decision in this repo must serve that
spec. If a request conflicts with `MVP.md`, flag it explicitly before proceeding.

---

## Project Overview

**Goal.** A user creates a project, uploads a blueprint image, traces walls, marks
fixed points (water, drain, gas, electric, doors, windows), answers a guided Q&A,
and clicks Generate. The LLM proposes a placement of standard kitchen modules; a
deterministic validator checks constraints; the result is rendered on a Konva
canvas the user can refine. Export to PNG and JSON.

**Scope.** This is an MVP. Single-user. No auth. No multi-tenant. No 3D. Bias
toward shipping the smallest thing that proves the loop end-to-end.

**Stack.**
| Layer | Choice |
| --- | --- |
| Frontend | React 18 + TypeScript (strict) + Vite |
| Canvas | Konva.js via `react-konva` |
| State | Zustand |
| Styling | Tailwind CSS |
| Backend | Node.js + TypeScript + Hono |
| Database | SQLite via `better-sqlite3` (single `projects` table, JSON blob per project) |
| LLM | Vercel AI SDK (`ai` + `@ai-sdk/google` / `@ai-sdk/anthropic`); default Google Gemini 2.5 Flash, pluggable to Claude Sonnet 4.5 via `LLM_PROVIDER`. Tool-calling + Zod for every structured output. |
| Monorepo | pnpm workspaces + Turborepo |

**Coordinate system.** All measurements in millimetres. Origin at top-left of the
traced walls' bounding box. +x right, +y down. Match Konva's screen frame so there
is no conversion confusion. Convert px ↔ mm via `pxPerMm` only at render time.

---

## Monorepo Structure

```
/
├── apps/
│   ├── web/                  # Vite + React + Konva + Tailwind
│   └── api/                  # Hono + SQLite + Vercel AI SDK (Gemini default)
├── packages/
│   └── shared/               # Types, constants, validator (pure TS)
│       ├── src/
│       │   ├── types.ts      # Project, Wall, FixedPoint, Module, Preferences, Layout
│       │   ├── constants.ts  # STANDARD_MODULES, CLEARANCES, WORK_TRIANGLE
│       │   ├── validator.ts  # Deterministic layout validator
│       │   └── index.ts
│       └── package.json
├── .claude/
│   ├── commands/             # Custom slash commands
│   └── settings.json
├── backlog/
│   ├── backlog.md            # Active feature list
│   ├── todo/                 # Individual feature files
│   └── completed/            # Finished features
├── decisions/                # Architecture Decision Records
├── githooks/                 # Tracked git hooks (pre-commit)
├── scripts/                  # Repo-level scripts (backlog consistency check, etc.)
├── CLAUDE.md                 # This file
├── MVP.md                    # Product spec — source of truth
└── turbo.json
```

Each subdirectory may add its own `CLAUDE.md` for area-scoped context. When one
exists, it overrides this file for files inside that directory.

---

## Architecture Decision Records

Significant architectural decisions are documented in [`decisions/`](./decisions/).
Before making a choice that touches the canvas/coordinate model, the validator,
LLM integration, or persistence, read the relevant ADR first.

| ADR | Decision |
| --- | --- |
| [ADR-001](./decisions/ADR-001-monorepo-pnpm-turbo.md) | pnpm workspaces + Turborepo for `apps/web`, `apps/api`, `packages/shared` |
| [ADR-002](./decisions/ADR-002-millimetres-as-canonical-unit.md) | Millimetres are the canonical unit; px is render-only |
| [ADR-003](./decisions/ADR-003-sqlite-json-blob-per-project.md) | Persist each project as a single JSON blob in SQLite |
| [ADR-004](./decisions/ADR-004-validator-first-llm-second.md) | Validator is the source of truth; the LLM repairs against it |
| [ADR-005](./decisions/ADR-005-llm-tool-calling-with-zod.md) | All LLM outputs must come through tool calls and be Zod-validated |
| [ADR-006](./decisions/ADR-006-provider-agnostic-llm-via-ai-sdk.md) | Provider-agnostic LLM via Vercel AI SDK; default Gemini 2.5 Flash |

If you are about to make a decision that contradicts an existing ADR, stop and
flag it explicitly. If the decision genuinely needs to change, write a new ADR
that supersedes the old one.

---

## Development Lifecycle

**Never commit directly to `main`.** All changes go through a Pull Request. Branch
protection enforces this — direct pushes to main are blocked.

### Branch Naming

| Type | Pattern |
| --- | --- |
| Feature | `feature/F-XXX-short-name` |
| Fix | `fix/short-description` |
| Chore | `chore/short-description` |
| Spike | `spike/short-description` |

### Workflow

1. **Sync main first** — `git checkout main && git pull origin main`
2. **Install dependencies** — `pnpm install`
3. **Start a branch** — `git checkout -b feature/F-XXX-description`
4. **Work and commit** — conventional commits on the branch
5. **Create a PR** — use `/create-pr` at the end of the session
6. **Wait for CI** — use `/watch-pr` to monitor; Claude polls every 30 seconds
7. **Merge** — only after CI passes and PR is approved

### CI Gates (run on every PR)

- `pnpm lint` — zero ESLint errors
- `pnpm type-check` — zero TypeScript errors (strict mode)
- `pnpm build` — all packages and apps build cleanly
- `pnpm --filter @galley/shared test` — validator unit tests pass

---

## Custom Commands

Slash commands live in `.claude/commands/`. Use them to start guided workflows:

| Command | Purpose |
| --- | --- |
| `/create-pr` | Create a PR for the current branch and start CI watch |
| `/watch-pr` | Poll CI on the current PR; fix failures and review comments automatically |
| `/review-pr` | Review a PR, post inline comments per finding, submit REQUEST_CHANGES |
| `/discover` | Explore galley's architecture, data model, API surface, and UI |
| `/tackle-backlog` | Spawn one agent per backlog feature (coordinator for dependent features) |
| `/audit-validator` | Audit the layout validator against the spec checks (containment, clearances, triangle, etc.) |
| `/rules-audit` | Score the quality of AI rules (CLAUDE.md, MVP.md, ADRs) across 8 criteria |
| `/setup-environment` | Walk a new contributor through local setup |

---

## Validator-First Rule

**The deterministic validator in `packages/shared/src/validator.ts` is the source
of truth for layout correctness.** The LLM is a proposer, not an authority. Every
generation request follows this loop:

1. LLM is given walls, fixed points, preferences, the standard module library,
   and the clearance constants.
2. LLM responds via the `propose_layout(modules, rationale)` tool.
3. Backend runs the validator. If `ok: true`, return the layout.
4. If invalid, the violations are sent back as a tool result and the LLM is asked
   to repair. Cap at 3 repair iterations.
5. After 3 failed iterations, return the best-effort layout with a warning
   surfaced in the UI.

**Implication for tests:** the validator is the most important code in this repo.
Cover it with unit tests using hand-crafted layouts (rectangular room, L-shape,
island, door-swing collision, work-triangle violation, etc.). UI glue does not
need tests.

---

## LLM Integration Rule

- **Never call the LLM from the browser.** Always proxy through `apps/api`.
- **The provider is selected at runtime** via `LLM_PROVIDER` (`google` default
  | `anthropic`). Both call sites use the Vercel AI SDK's `generateText` with
  Zod-defined `tool()` schemas — never import `@ai-sdk/google` or
  `@ai-sdk/anthropic` directly outside `apps/api/src/llm/provider.ts`. See ADR-006.
- **Every LLM tool-call response must be Zod-validated** before it is trusted.
  Schemas live in `packages/shared/src/schemas.ts`.
- **Stream Q&A responses** (one question at a time) for UX. Layout generation can
  be a single non-streamed call.
- **Log every LLM request/response** to a local file in dev mode (`./llm-logs/`,
  gitignored). This is non-negotiable when prompts misbehave.
- The system prompt for layout generation **must include**: room geometry, fixed
  points, preferences, the standard module library, and `CLEARANCES` /
  `WORK_TRIANGLE` constants. Pass them as JSON in the prompt — do not paraphrase.

---

## Persistence Rule

- Each project is stored as a single row in SQLite: `(id TEXT, name TEXT,
  created_at TEXT, data_json TEXT)`.
- Blueprint images live on the local filesystem at `apps/api/uploads/<projectId>/`.
- The frontend keeps a synced copy in Zustand and persists to the backend on
  meaningful transitions (e.g. wall trace complete, scale set, fixed point
  placed) — **not on every drag tick**. A debounced persistence helper is fine.
- All coordinates stored are in mm. Never persist pixel coordinates.

---

## Backlog

Current feature status is always in [`backlog/backlog.md`](./backlog/backlog.md).
Check it before starting work to understand what's done, in progress, and pending.

### When to complete a backlog item

**"Completing a feature" means: all code for the feature is committed, all
lifecycle gates pass locally, and you are about to open a PR.** Do this before
running `/create-pr` — not after, not in a separate session.

Specifically, complete the backlog item when **all of the following are true**:

- The feature's code is committed on the current branch
- `pnpm type-check` and `pnpm lint` report zero errors
- The validator tests pass (when the feature touches the validator)
- You are about to run `/create-pr`

If you forget and open the PR first, complete the backlog item in a follow-up
commit on the same branch before it merges.

### How to complete a backlog item

Follow these steps **in order** — the pre-commit hook enforces consistency:

1. Append the completion block to the feature file (date, PR placeholder, commit SHA, notes)
2. Copy the file to `backlog/completed/`
3. **Delete** the original from `backlog/todo/` — leaving it in both places will block the commit
4. Remove the row from `backlog/backlog.md`
5. **Create a git commit:**
   ```
   git commit -m "feat(backlog): complete F-XXX — <feature name>"
   ```

> The pre-commit hook checks that no file exists in both `backlog/todo/` and
> `backlog/completed/`. If you see a backlog consistency error at commit time,
> delete the file from `backlog/todo/`.

---

## Shell Command Rules

Follow these rules to avoid triggering permission prompts:

- **Never prefix commands with `cd path && ...`** — run commands directly from
  the working directory. Chaining `cd` causes the permission system to
  misclassify the command.
- **Use `git -C <path>`** if an explicit path is needed, not `cd <path> && git`.
- **Avoid shell builtins not in the allow list** (`cp`, `mv`, `mkdir`, `rm`).
  Use the dedicated file tools (`Write`, `Edit`, `Read`, `Glob`) instead — they
  never prompt.
- **Allowed Bash commands and the subcommands used in this project:**

  | Command | Allowed subcommands |
  | --- | --- |
  | `git` | `status`, `diff`, `add`, `commit`, `push`, `pull`, `fetch`, `merge`, `log`, `checkout`, `branch`, `rev-parse`, `stash`, `cherry-pick`, `config`, `rm` |
  | `pnpm` | `install`, `build`, `lint`, `type-check`, `test`, `dev`, `--filter <pkg> <script>`, `add`, `remove` |
  | `gh` | `pr view`, `pr create`, `pr checks --watch --interval 30`, `run view --log-failed`, `repo edit`, `api` |
  | `volta` | `install` |
  | `jq` | any — for parsing JSON output from `gh` commands |
  | `npx tsc` | type-check without a global install |

  Commands not in this table require user confirmation before running.

---

## Modifying AI Rules

**This section applies only when the current task involves editing one of these files:**

- Any `CLAUDE.md` file (root or area-scoped)
- `MVP.md`
- Any file in `decisions/`
- Any file in `.claude/commands/`

**If none of those files are being modified, skip this section — it is irrelevant context.**

When modifying AI rules:

1. Run `/rules-audit` before making changes to record the baseline score.
2. Make your changes.
3. Run `/rules-audit` again to confirm the score improved or did not regress.
4. Include the before/after scores in the PR description.
