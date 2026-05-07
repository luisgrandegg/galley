# Completed Features

Each completed feature lives here as its own file with a completion block
appended. The pre-commit hook (`scripts/check-backlog-consistency.js`) blocks
commits where the same filename exists in both `backlog/todo/` and
`backlog/completed/` — delete from `todo/` once you copy to `completed/`.

## Completion block format

Append this block at the bottom of the feature file before copying it here:

```markdown
---

## Completion

- **Completed:** YYYY-MM-DD
- **PR:** <PR title or link>
- **Commit:** <SHA>
- **Notes:** <one or two sentences — anything a future contributor should know>
```

See `CLAUDE.md § Backlog` for the full workflow.
