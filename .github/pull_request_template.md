## Summary

<!-- What does this PR do? 1–3 bullets. -->

-

## Type of change

- [ ] New feature (touches MVP scope)
- [ ] Bug fix
- [ ] Validator change
- [ ] LLM prompt / integration change
- [ ] Chore / tooling
- [ ] Docs / context files

## Test plan

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm type-check` passes
- [ ] `pnpm --filter @galley/shared test` passes (validator)
- [ ] Manual: tested the affected user flow end-to-end in the dev server

## Validator changes

<!-- Complete only if this PR modifies packages/shared/src/validator.ts or its tests. -->

- [ ] `/audit-validator` run — every spec check (containment, overlap, wall adjacency, fixed-point alignment, door swing, walkway, work triangle, appliance front) is covered
- [ ] New invariants have at least one positive and one negative unit test

## Backlog

<!-- If this PR completes a backlog item, confirm it has been moved from todo/ to completed/ and removed from backlog.md. -->

- [ ] Backlog item completed (or N/A)
