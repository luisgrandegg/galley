# /tackle-backlog

Read the active backlog, analyse dependencies between features, then spawn one
agent per independent feature — or a coordinator agent when features share
foundation code. Monitor until all agents complete.

---

## What to do

### Step 1 — Read the backlog

Read `backlog/backlog.md` and every file in `backlog/todo/` to understand:

- Which features are Planned.
- Their acceptance criteria and technical notes.
- Which app/package each feature touches (web, api, shared).

### Step 2 — Build the dependency graph

For each Planned feature, determine:

- Which files it creates or modifies.
- Which other features create files it depends on.
- Whether it shares foundation code (types, validator rules, canvas helpers,
  toolbar layout) with other features.

Classify:

- **Independent** — touches only its own files, no shared foundation.
- **Dependent** — needs foundation built by another feature, or shares files
  with one.

### Step 3 — Decide on agents

**Independent features:** spawn one `general-purpose` agent per feature with
`isolation: "worktree"`. Each agent works on its own branch.

**Dependent features:** spawn one coordinator `general-purpose` agent that:

1. Builds the shared foundation first (committed to the branch).
2. Builds each dependent feature on top, in dependency order.
3. Opens a single PR covering all features in the group.

When spawning an agent, include in the prompt:

- The full contents of the relevant `backlog/todo/` feature file(s).
- The relevant ADRs (link to them, do not paraphrase).
- Branch name: `feature/F-XXX-short-name`.
- Instruction to run `pnpm type-check`, `pnpm lint`, and the validator tests
  before committing.
- Instruction to complete the backlog item(s) before running `/create-pr`.

### Step 4 — Spawn agents

Independent agents launch in parallel (`run_in_background: true`). The
coordinator runs first if its foundation is needed downstream — otherwise
parallel.

### Step 5 — Report results

When all agents complete, summarise:

- Which features were implemented.
- Which PRs were opened.
- Any failures or gaps that need follow-up.
