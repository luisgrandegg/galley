# /rules-audit

Audit the quality of the AI rules that govern this project — `CLAUDE.md`,
`MVP.md`, every ADR in `decisions/`, and `.claude/` configuration. Produces a
scored report (0–10 per criterion) with concrete improvement actions.

**Run as: `/rules-audit`** — no arguments. Reads all rule sources automatically.

---

## What to do

### Step 1 — Read all rule sources

Read these in full before scoring:

- `MVP.md`
- `CLAUDE.md` (root)
- Any area-scoped `CLAUDE.md` (`apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`,
  `packages/shared/CLAUDE.md`)
- Every file in `decisions/`
- Every file in `.claude/commands/`
- `.claude/settings.json`

### Step 2 — Score each of the 8 criteria

Score 0–10. Cite specific evidence for every score (file, section, or line) —
never score without evidence.

#### C1 — Clarity

Are instructions specific and unambiguous? Penalise vague qualifiers ("as
needed", "when appropriate", "consider").

| Score | Meaning |
|---|---|
| 0–2 | Rules abstract — agents must guess intent |
| 3–5 | Mix of clear and vague |
| 6–8 | Most rules actionable; a few edge cases unclear |
| 9–10 | Every rule has a testable, specific condition |

#### C2 — Completeness

Do the rules cover the scenarios an agent encounters in this project?

- Adding a new validator rule
- Modifying the LLM prompt
- Adding a Hono route
- Adding a Konva editor tool
- Updating shared types
- Working with the backlog
- Making a PR or commit
- Running shell commands

| Score | Meaning |
|---|---|
| 0–2 | Major categories uncovered |
| 3–5 | Core scenarios covered; edge cases missing |
| 6–8 | Good coverage; minor gaps |
| 9–10 | Every common task has explicit guidance |

#### C3 — Consistency

Do rules across files agree? Look for contradictions, undefined precedence
between files, or duplicated rules that say different things.

#### C4 — Actionability

Can an agent take immediate, correct action? Code examples, do/don't pairs,
exact commands.

#### C5 — Enforcement

Are rules backed by automated checks? CI gates, pre-commit hooks, slash
commands.

#### C6 — Spec alignment

Do technical rules connect back to `MVP.md` and the ADRs? Can you trace a
technical decision to a specific clause?

#### C7 — `.claude/` coverage

Verify all of:

- Every command listed in CLAUDE.md's "Custom Commands" table has a matching
  file in `.claude/commands/`.
- Every file in `.claude/commands/` is referenced in CLAUDE.md (no orphans).
- `settings.json` permissions cover the bash commands the project runs.
- Any rule that describes an automated behaviour is wired as a hook.

#### C8 — Freshness

- Every ADR in `decisions/` references tools and files that still exist.
- Every CI gate cited in CLAUDE.md matches an actual job in
  `.github/workflows/`.
- Backlog rows in `backlog.md` reference files that still exist in the right
  folder.

### Step 3 — Print the scored report

```
/rules-audit — galley

  C1  Clarity              X/10  [✅|⚠️|❌]
  C2  Completeness         X/10  [✅|⚠️|❌]
  C3  Consistency          X/10  [✅|⚠️|❌]
  C4  Actionability        X/10  [✅|⚠️|❌]
  C5  Enforcement          X/10  [✅|⚠️|❌]
  C6  Spec alignment       X/10  [✅|⚠️|❌]
  C7  .claude/ coverage    X/10  [✅|⚠️|❌]
  C8  Freshness            X/10  [✅|⚠️|❌]

  Overall: X.X / 10

  Legend: ✅ ≥8   ⚠️ 6–7   ❌ <6
```

### Step 4 — Detail improvements for any criterion below 8

```
─────────────────────────────────────────
IMPROVEMENTS

CX  Name — X/10
    Evidence: [file, section, or specific issue]
    → Action 1
    → Action 2
─────────────────────────────────────────
```

### Step 5 — Offer quick fixes

For mechanical issues (orphaned command file, missing entry in CLAUDE.md's
table, stale backlog row), ask:

> "Would you like me to apply these fixes now?"

Apply only if the user confirms. Never apply silently.
