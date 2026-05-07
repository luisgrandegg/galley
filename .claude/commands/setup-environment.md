# /setup-environment

Walk a new contributor through local setup for galley. Detect their OS and
tailor every step. Be conversational — check in after each major step.

---

## Step 1 — Detect OS

Ask the user which OS they are on:

- **macOS** → Homebrew / curl
- **Linux** → curl / package manager
- **Windows** → winget / MSI

---

## Step 2 — Install Volta

Volta pins Node and pnpm versions per-repo automatically (defined in
`package.json`).

**macOS / Linux:**

```bash
curl https://get.volta.sh | bash
# Restart terminal, or:
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"
```

**Windows (winget):**

```powershell
winget install Volta.Volta
# Restart terminal
```

Verify: `volta --version`.

---

## Step 3 — Install Node and pnpm via Volta

```bash
volta install node@22.22.2
volta install pnpm@9.15.0
```

Verify: `node -v` (v22.22.2), `pnpm -v` (9.15.0).

---

## Step 4 — Install GitHub CLI and authenticate

**macOS:** `brew install gh` — **Linux:** distro package — **Windows:**
`winget install GitHub.cli`.

```bash
gh auth login
gh auth status
```

---

## Step 5 — Install jq (for `gh` JSON parsing)

**macOS:** `brew install jq` — **Linux:** distro package — **Windows:**
`winget install jqlang.jq`.

Verify: `jq --version`.

---

## Step 6 — Install dependencies

```bash
pnpm install
```

The `prepare` script wires up `git config core.hooksPath githooks` so the
backlog-consistency pre-commit hook runs.

---

## Step 7 — Set the LLM API key

Create `apps/api/.env` based on `apps/api/.env.example`. The default provider
is **Google Gemini** (free tier via Google AI Studio):

```
LLM_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=...
```

Get a free key at https://aistudio.google.com/app/apikey.

To use Claude instead, set:

```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Without a key for the active provider, the Q&A and layout generation
endpoints will return 503. See [ADR-006](../../decisions/ADR-006-provider-agnostic-llm-via-ai-sdk.md).

---

## Step 8 — Verify the lifecycle gates

```bash
pnpm lint
pnpm type-check
pnpm build
pnpm --filter @galley/shared test
```

All four must pass.

---

## Step 9 — Run the dev server

```bash
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `volta: command not found` | Restart terminal / re-source shell profile |
| `pnpm: command not found` | `volta install pnpm@9.15.0` again |
| `pnpm install` fails (frozen lockfile) | `pnpm install --no-frozen-lockfile`, then commit the updated lockfile |
| `better-sqlite3` build error | Ensure native build tools are installed (`xcode-select --install` on macOS, `build-essential` on Debian/Ubuntu, MSVC build tools on Windows) |
| API returns 503 on `/api/projects/:id/qa/next` | `apps/api/.env` is missing the API key for the active `LLM_PROVIDER` (`GOOGLE_GENERATIVE_AI_API_KEY` for `google`, `ANTHROPIC_API_KEY` for `anthropic`) |
| Pre-commit hook not running | `git config core.hooksPath githooks` (or re-run `pnpm install`) |

---

## Done

Confirm:

- Volta is managing Node and pnpm
- `gh` is authenticated
- Pre-commit hook is enforcing backlog consistency
- `pnpm dev` runs both apps cleanly

Suggest checking `backlog/backlog.md` to pick a feature.
