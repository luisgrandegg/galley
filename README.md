# galley

A web app where a user uploads a kitchen blueprint, answers a guided AI Q&A, and
receives a 2D top-down kitchen layout rendered on Canvas that they can refine
manually.

> Read [`MVP.md`](./MVP.md) for the full product spec — it is the source of truth
> for what galley is and what is in/out of scope.
>
> Read [`CLAUDE.md`](./CLAUDE.md) for the contributor and AI-agent context.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + TypeScript (strict) + Vite |
| Canvas | Konva.js via `react-konva` |
| State | Zustand |
| Styling | Tailwind CSS |
| Backend | Node.js + Hono |
| Database | SQLite (`better-sqlite3`) |
| LLM | Anthropic SDK — Claude Sonnet 4 with tool-calling |
| Monorepo | pnpm workspaces + Turborepo |

---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `22.x` | Pinned via [Volta](https://volta.sh) |
| pnpm | `9.15.x` | Set via `packageManager` field |

---

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Set ANTHROPIC_API_KEY for the API
echo "ANTHROPIC_API_KEY=sk-ant-..." > apps/api/.env

# 3. Run the dev server (web + api in parallel)
pnpm dev
```

The web app runs on `http://localhost:5173` and proxies `/api/*` to the API on
`http://localhost:3001`.

---

## Project structure

```
/
├── apps/
│   ├── web/          # Vite + React + Konva + Tailwind
│   └── api/          # Hono + SQLite + Anthropic SDK
├── packages/
│   └── shared/       # Types, constants, validator (pure TS)
├── .claude/
│   └── commands/     # AI-assisted workflow commands
├── backlog/          # Active and completed feature files
├── decisions/        # Architecture Decision Records (ADRs)
├── CLAUDE.md         # AI agent instructions
├── MVP.md            # Product spec — source of truth
└── turbo.json
```

---

## Common commands

```bash
pnpm dev              # Run web + api in parallel
pnpm build            # Build everything
pnpm lint             # Lint all packages
pnpm type-check       # TypeScript check across the monorepo
pnpm test             # Run unit tests (validator)

# Scoped
pnpm --filter @galley/web dev
pnpm --filter @galley/api dev
pnpm --filter @galley/shared test
```

---

## AI-assisted workflows

This repo uses Claude Code with custom slash commands:

| Command | Purpose |
| --- | --- |
| `/create-pr` | Create a PR for the current branch and start CI watch |
| `/watch-pr` | Poll CI; fix failures and resolve review comments automatically |
| `/review-pr` | Review a PR, post inline comments per finding, submit REQUEST_CHANGES |
| `/discover` | Explore galley's architecture, data model, API surface, and UI |
| `/tackle-backlog` | Spawn one agent per backlog feature |
| `/audit-validator` | Audit the layout validator against every spec check |
| `/rules-audit` | Score the quality of AI rules across 8 criteria |
| `/setup-environment` | Walk a new contributor through local setup |

---

## Contributing

**Never commit directly to `main`.** All changes go through a Pull Request.

```bash
git checkout main && git pull origin main
pnpm install
git checkout -b feature/F-XXX-description
# ... work + commit ...
# /create-pr
```

### CI gates

Every PR must pass:

- `pnpm lint` — zero ESLint errors
- `pnpm type-check` — zero TypeScript errors (strict mode)
- `pnpm build` — all packages and apps build cleanly
- `pnpm --filter @galley/shared test` — validator unit tests pass

---

## Architecture decisions

| ADR | Decision |
| --- | --- |
| [ADR-001](./decisions/ADR-001-monorepo-pnpm-turbo.md) | pnpm workspaces + Turborepo |
| [ADR-002](./decisions/ADR-002-millimetres-as-canonical-unit.md) | Millimetres are the canonical unit; px is render-only |
| [ADR-003](./decisions/ADR-003-sqlite-json-blob-per-project.md) | Persist each project as a single JSON blob in SQLite |
| [ADR-004](./decisions/ADR-004-validator-first-llm-second.md) | Validator is the source of truth; the LLM repairs against it |
| [ADR-005](./decisions/ADR-005-llm-tool-calling-with-zod.md) | All LLM outputs come through tool calls, validated with Zod |

---

## License

MIT.
