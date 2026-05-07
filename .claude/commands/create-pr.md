# /create-pr

Create a Pull Request for the current branch, then monitor CI until it passes.

---

## What to do

### Step 1 — Complete any finished backlog items

Before creating the PR, check whether this branch implements any feature in
`backlog/todo/` or currently listed as Planned in `backlog/backlog.md`.

For each feature completed by this branch:

1. Read the feature file from `backlog/todo/`.
2. Append the completion block (date, PR title placeholder, commit SHA, notes).
3. Write the file to `backlog/completed/` (use Write — same filename).
4. Delete the original from `backlog/todo/`.
5. Update the row in `backlog/backlog.md` (status → "Done — \<branch\>") or
   remove it if the row was just a placeholder.
6. Commit: `git commit -m "feat(backlog): complete F-XXX — <feature name>"`.

**Do not skip this step.** A PR cannot represent done work if the backlog still
says Planned.

### Step 2 — Confirm validator coverage (only when relevant)

If this PR modifies `packages/shared/src/validator.ts` or its tests, ask:
"Have you run `/audit-validator`? Are all spec checks covered?"

- If not run: offer to run `/audit-validator` now.
- If run and all checks pass: proceed.
- If failures were acknowledged: note them in the PR description and continue.

### Step 3 — Verify branch

```bash
git rev-parse --abbrev-ref HEAD
```

If on `main`, stop and tell the user: "You are on the main branch. Create a
feature branch first with `git checkout -b feature/description`."

### Step 4 — Ensure changes are committed

```bash
git status
```

If there are uncommitted changes, ask the user whether to commit them before
opening the PR. If yes, stage and commit with an appropriate message.

### Step 5 — Sync with main before pushing

```bash
git fetch origin main
git merge origin/main
```

**If there are conflicts:**

1. List conflicting files: `git diff --name-only --diff-filter=U`
2. Resolve each one with `Edit` — keep the feature branch's change unless the
   base introduced a token, convention, or structural update.
3. For `pnpm-lock.yaml`: `git checkout --theirs pnpm-lock.yaml && pnpm install --no-frozen-lockfile`.
4. Commit the resolution: `git commit -m "chore(merge): merge main into <branch>"`

Then:

```bash
git push -u origin HEAD
```

### Step 6 — Check for existing PR

```bash
gh pr view --json number,url 2>/dev/null
```

If a PR already exists, skip to Step 8.

### Step 7 — Create the PR

Use the PR template from `.github/pull_request_template.md`. Fill in:

- **Title** — concise, conventional commits style (`feat:`, `fix:`, `chore:`)
- **Body** — fill the template sections from the diff

```bash
gh pr create --title "<title>" --body "<filled template>" --base main
```

### Step 8 — Monitor CI

Run `/watch-pr` to monitor CI status.
