# ADR-006 — Provider-agnostic LLM via the Vercel AI SDK; default Gemini 2.5 Flash

**Status:** Accepted
**Date:** 2026-05-07

## Context

ADR-005 fixed our LLM contract — every structured output goes through tool
calls and is Zod-validated — but it left the provider open. Initial code in
`apps/api/src/llm/anthropic.ts` was hard-bound to `@anthropic-ai/sdk`, which is
fine for Claude but blocks two things:

1. **Free-tier development.** Claude has no free tier; iterating on the Q&A and
   layout prompts during MVP development is metered. Google's Gemini has a
   generous free tier through Google AI Studio.
2. **Provider experimentation.** The most likely failure mode for galley is the
   LLM proposing layouts that fail the validator's repair loop too often. We
   want to be able to A/B providers without rewriting the call sites.

We need an abstraction that preserves the ADR-005 guarantees (tool calling,
Zod validation, dev-mode logging) while letting us swap providers via an env
var.

## Decision

Use the **Vercel AI SDK** (`ai` + provider packages `@ai-sdk/google` and
`@ai-sdk/anthropic`) as the unified interface. Default provider is **Google
Gemini 2.5 Flash**.

1. `apps/api/src/llm/provider.ts` exports `getModel()`, which returns a
   `LanguageModel` based on `LLM_PROVIDER`:
   - `LLM_PROVIDER=google` (default) → `gemini-2.5-flash` via
     `GOOGLE_GENERATIVE_AI_API_KEY`.
   - `LLM_PROVIDER=anthropic` → `claude-sonnet-4-5` via `ANTHROPIC_API_KEY`.
   - `GALLEY_MODEL` overrides the model id for the active provider.
2. Both call sites (`qa.ts`, `layout.ts`) use `generateText({ model, tools,
   toolChoice, ... })` from the AI SDK. Tools are declared with `tool({
   description, inputSchema })` where `inputSchema` is a Zod schema — this
   collapses ADR-005's prior split of "JSON schema for the SDK + Zod schema
   for runtime validation" into a single source of truth.
3. The repair loop in `layout.ts` carries the assistant's previous tool call
   plus a `tool-result` message and a user repair instruction across iterations
   — the AI SDK's `ModelMessage` shape works identically against Google and
   Anthropic backends, so no provider-specific message handling lives in
   `layout.ts`.
4. A typed `MissingApiKeyError` from `provider.ts` is mapped to a 503 in
   `server.ts`, replacing the old substring match on `"ANTHROPIC_API_KEY"`.
5. ADR-005 is **not** superseded. Tool calling and Zod validation remain the
   contract; this ADR only changes how the SDK is procured.

## Alternatives Considered

- **Hand-rolled `LLMProvider` interface with per-provider implementations.**
  More control over wire formats, but every provider would need its own
  tool-call message shape (Anthropic vs Google differ on JSON-schema dialects,
  tool-result encoding, and `toolChoice` flags). The AI SDK already does this
  normalisation; doing it in-house is rebuilding the same plumbing for no
  benefit at MVP scale.
- **OpenRouter as a single endpoint.** Adds a third party between us and the
  model, charges-per-call past the free tier, and has unpredictable rate limits
  on the free routes. Worth revisiting if we ever need 5+ providers; not
  worth it for two.
- **Self-hosted Gemma via Ollama.** Truly free and offline, but open Gemma
  weights have weak tool-calling in practice — the layout repair loop would
  thrash. Acceptable for non-tool prose, not acceptable for structured output.
- **Stay on Anthropic only.** Rejected per the Context section: blocks
  free-tier iteration and locks in one provider for the layout-quality A/B we
  expect to need.

## Consequences

**Positive.**
- Default development cost goes to zero (Gemini free tier).
- Switching providers is one env var (`LLM_PROVIDER`), no code change.
- Zod schemas in `packages/shared/src/schemas.ts` are now the only structured
  output contract — the SDK derives the wire-level JSON schema from them.
- The repair loop is provider-neutral; we can A/B providers on layout quality
  by re-running with `LLM_PROVIDER=anthropic`.

**Negative.**
- One additional indirection (`ai` + `@ai-sdk/google` + `@ai-sdk/anthropic`)
  in `apps/api/package.json`. The transitive footprint is small; build is
  unaffected.
- Gemini Flash is a smaller model than Sonnet. The layout repair loop may need
  more iterations on complex rooms; if violations after `MAX_REPAIRS=3` become
  routine, raise the cap or fall back to `LLM_PROVIDER=anthropic` for layout.
  We'll watch the `llm-logs/` output during development.
- Tool-call schemas must avoid Gemini-incompatible Zod features (e.g. nested
  `z.union` of object types with overlapping keys, `z.unknown()` inside object
  fields). The current schemas in `packages/shared/src/schemas.ts` are simple
  enough that this isn't an issue today; adding new schemas should keep that
  in mind.
