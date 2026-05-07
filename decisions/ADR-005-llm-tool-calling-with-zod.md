# ADR-005 — LLM tool-calling, Zod-validated outputs

**Status:** Accepted
**Date:** 2026-05-07

## Context

The Q&A wizard and the layout generator both depend on the LLM producing
*structured* output: a question with optional quick-pick chips, a finalised
`Preferences` object, or a list of `Module`s with a rationale.

Free-form prose, parsed with regex or string matching, will fail. The Anthropic
SDK supports tool-calling, which forces the model to produce JSON conforming to
a declared schema. We should use it consistently for every structured output.

JSON-schema declarations are not enough on their own — the model occasionally
returns shapes that pass schema check but contain sentinel values, NaN
coordinates, or unknown enum cases. We need a runtime guard before we trust
anything.

## Decision

1. **Every structured LLM call uses tool-calling**, not free-form text. The
   tools are:
   - `ask_question(text: string, quickPicks?: string[])`
   - `finalize(preferences: Preferences)`
   - `propose_layout(modules: Module[], rationale: string)`
2. **Every tool response is parsed through a Zod schema** colocated in
   `packages/shared/src/schemas.ts` (importable from both apps). If parsing
   fails, we treat the call as a transient error and retry once with the parse
   error fed back to the model.
3. **Never call the LLM from the browser.** The frontend talks to
   `apps/api`; only `apps/api` holds the API key.
4. **Log every LLM request and response** to `./llm-logs/<timestamp>.json` in
   dev mode. The log is gitignored. This is non-negotiable when prompts
   misbehave — without it, debugging is guesswork.

## Alternatives Considered

- **Free-form JSON in `<output>` tags, parsed by hand.** Works until it
  doesn't. Tool-calling is what the SDK is for.
- **TypeScript types as ground truth, no runtime validation.** TypeScript
  doesn't run at runtime. Zod does.
- **Streaming structured output without validation.** We can stream Q&A *prose*
  as it arrives, but the structured tool call must be complete before we trust
  it. Zod is the gate.

## Consequences

**Positive.**
- The backend can rely on every LLM-derived value matching its TypeScript type.
- One central place (`schemas.ts`) defines every wire shape — easy to audit.
- The dev log makes prompt regressions obvious instead of mysterious.

**Negative.**
- A schema change requires updating the Zod schema, the TypeScript type, and
  the tool definition. We keep them adjacent so this is one edit, not three.
- Tool-calling is slightly more verbose than asking for JSON. Worth it.
