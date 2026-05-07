# /review-pr

Perform a thorough code review on a Pull Request, post an inline comment for
each finding, and submit the review requesting changes.

**Usage:** `/review-pr <PR>` where `<PR>` is one of:
- A full GitHub PR URL: `https://github.com/owner/repo/pull/123`
- A shorthand repo + number: `owner/repo#123`
- A plain PR number (uses current repo): `123`

---

## What to do

### Step 1 — Parse the PR reference

From `$ARGUMENTS`, extract `OWNER`, `REPO`, `PR_NUMBER`.

If the input is empty or cannot be parsed, ask: "Please provide a PR reference
— a GitHub URL, `owner/repo#number`, or a plain PR number."

### Step 2 — Fetch PR metadata

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER
```

Record `title`, `body`, `head.sha`, `base.ref`, `head.ref`, `user.login`.

### Step 3 — Fetch the changed files and diff

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/files
```

For each non-binary, non-removed file: `filename`, `status`, `patch`, plus the
full content via Read.

### Step 4 — Fetch existing comments and reviews

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews
```

Don't duplicate findings already flagged.

### Step 5 — Perform the review

Review every changed file. For each finding, record:

- `path` — file path as returned by the files API
- `line` — line in the **right (new) side**
- `side` — always `"RIGHT"`
- `summary` — one sentence: what is wrong
- `detail` — concrete solution

**Review criteria — galley-specific:**

**Spec alignment (`MVP.md` is the source of truth)**
- Code introduces functionality outside MVP scope (auth, multi-user, 3D, PDF
  parsing, etc.) — flag and ask to defer.
- Hardcoded numeric constants that should come from `STANDARD_MODULES`,
  `CLEARANCES`, or `WORK_TRIANGLE` — flag.

**Coordinates and units (ADR-002)**
- Pixel values stored on `Project`, `Wall`, `FixedPoint`, or `Module`. Forbidden.
- `* pxPerMm` or `/ pxPerMm` outside the canvas conversion helper — centralise it.

**Validator (ADR-004)**
- New layout invariant added without a corresponding unit test — flag.
- Validator returning early before all violations are collected — flag.
- Validator using floating-point equality without a tolerance — flag.

**LLM integration (ADR-005)**
- LLM call from the browser. Forbidden — must go through `apps/api`.
- LLM tool response trusted without Zod validation — flag.
- API key referenced anywhere in `apps/web` — forbidden.

**TypeScript / correctness**
- `any` types or implicit `any`.
- Missing return types on exported functions.
- Non-null assertions (`!`) without a justifying comment.
- `as` casts that bypass safety (prefer type guards).
- Unused imports or variables.

**Security**
- `dangerouslySetInnerHTML` without sanitisation.
- `eval()` or `new Function()`.
- User-controlled values interpolated into URLs or shell commands.

**Code quality**
- `console.log` left in production code (logging the LLM call to disk is fine).
- Dead code or commented-out blocks.
- Logic that can be simplified significantly.

**Do not flag:**
- Style preferences enforced by the linter.
- Issues already flagged in existing reviews.
- Files with `status: "removed"`.

### Step 6 — Self-assign as reviewer

```bash
CURRENT_USER=$(gh api user --jq .login)
```

If non-empty:

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/requested_reviewers \
  --method POST \
  --field "reviewers[]=$CURRENT_USER"
```

Compare with `user.login`; set `IS_AUTHOR=true` if they match.

If there are no findings, tell the user: "No issues found. You've been added as
a reviewer — submit an approval manually if you're satisfied." Stop.

### Step 7 — Build and post the review

- If `IS_AUTHOR=false`: `event = "REQUEST_CHANGES"`.
- If `IS_AUTHOR=true`: `event = "COMMENT"`, prepend "Findings posted as
  comments — REQUEST_CHANGES is not available when the reviewer is the PR
  author." to the review body.

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews \
  --method POST \
  --input - <<'REVIEW_EOF'
{
  "event": "<REQUEST_CHANGES or COMMENT>",
  "commit_id": "<HEAD_SHA from Step 2>",
  "body": "<2–4 sentence summary of the main themes>",
  "comments": [
    {
      "path": "<path>",
      "line": <line>,
      "side": "RIGHT",
      "body": "**Issue:** <summary>\n\n**Suggestion:** <detail>"
    }
  ]
}
REVIEW_EOF
```

If the API returns 422 with `"line is not part of the diff"`, correct the line
to one inside the patch hunk and retry once.

### Step 8 — Confirm and report

Tell the user the count of comments, list each `path:line — summary`, and the
review URL. Do not re-read the review after posting.
