# /watch-pr

Monitor the CI status of the current branch's Pull Request. Poll until all
checks pass or fail, then report and act.

---

## What to do

### Step 1 — Find the PR

```bash
gh pr view --json number,url,state,title,headRefName
```

If no PR exists for the current branch, tell the user and offer to create one
(`gh pr create`).

### Step 1.5 — Check for merge conflicts

```bash
gh pr view --json mergeable,mergeStateStatus
```

**If `mergeable` is `CONFLICTING`:**

1. `git fetch origin main && git merge origin/main`
2. List conflicts: `git diff --name-only --diff-filter=U`
3. Resolve each conflict using `Edit`. Keep the feature branch's change unless
   the base introduced a token, convention, or structural update.
4. For `pnpm-lock.yaml`: `git checkout --theirs pnpm-lock.yaml && pnpm install --no-frozen-lockfile`.
5. Commit: `git commit -m "chore(merge): merge main into <branch>"`.
6. Push — CI re-triggers. Continue to Step 2.

### Step 2 — Poll CI checks and PR status together

```bash
gh pr checks --watch --interval 30
```

While waiting, also poll:

```bash
gh pr view --json mergeable,mergeStateStatus
```

If `mergeable` becomes `CONFLICTING`, stop the wait and go back to Step 1.5.

### Step 3 — Interpret the final result

```bash
gh pr checks
gh pr view --json mergeable,mergeStateStatus
```

**If all checks pass AND `mergeable` is `MERGEABLE`:** proceed to Step 3.5.

**If any CI check fails:**

1. Show which check failed and what the error was: `gh run view <run-id> --log-failed`.
2. Diagnose the failure. Common cases:
   - **Validator test failure** — read the failing test in
     `packages/shared/src/validator.test.ts`, fix the validator or the test.
   - **Type-check failure** — read the diagnostic, fix the offending file.
   - **Lint failure** — fix the offending file.
3. Commit the fix on the same branch — the push re-triggers CI.
4. Re-run `/watch-pr`.

**If `mergeable` is `CONFLICTING` (even if CI passed):** go back to Step 1.5.

---

### Step 3.5 — Resolve outstanding review comments

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments
```

- Collect all reviews where `state` is `CHANGES_REQUESTED`.
- For each, fetch its inline comments (filter `/comments` by `pull_request_review_id`).
- Skip self-reviews (`user.login` matches the PR author).
- If no reviews have `state: CHANGES_REQUESTED`, skip to Step 4.

**For each unresolved inline comment:** read the `path` and `line`, read the
file, apply the minimal fix using Edit. If the fix is ambiguous or requires a
design decision, skip it and flag at the end.

**For each top-level review body:** apply concrete actionable changes; skip
purely informational ones.

After all fixes:

```bash
git add <changed files>
git commit -m "fix(review): address PR review comments"
```

Push and re-run `/watch-pr` from Step 2.

If some comments were skipped, list them clearly to the user.

---

### Step 4 — Done

Tell the user: "All CI checks passed and all review comments have been
addressed — the PR is ready to merge."

Do not merge unless the user explicitly asks.
