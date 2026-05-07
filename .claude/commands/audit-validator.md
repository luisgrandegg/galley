# /audit-validator

Audit the deterministic layout validator against every check declared in
`MVP.md`. Produces a structured pass/fail/missing report and offers to add
missing tests.

The validator lives in `packages/shared/src/validator.ts` and its tests in
`packages/shared/src/validator.test.ts`. This command is the regression guard:
the validator is the source of truth (ADR-004), so it must cover every spec
rule.

---

## What to do

### Step 1 — Read the spec

Read `MVP.md` § "Layout Validator (deterministic)". The 8 checks declared
there are the source of truth:

| # | Check | What it verifies |
|---|---|---|
| 1 | Containment | Every module footprint lies inside the wall polygon |
| 2 | No overlap | Module footprints don't overlap each other |
| 3 | Wall adjacency | Base/wall/tall cabinets back against a wall (≤ 50 mm), except islands |
| 4 | Fixed-point alignment | Sink ≤ 600 mm of water+drain; hob near gas/electric per type; fridge/dishwasher ≤ 600 mm of an electric point |
| 5 | Door swing clear | No module footprint inside any door's swing arc |
| 6 | Walkway clearance | ≥ `CLEARANCES.walkway` mm between parallel cabinet runs |
| 7 | Work triangle | Sink/hob/fridge centres satisfy `WORK_TRIANGLE` |
| 8 | Appliance front clearance | ≥ `CLEARANCES.applianceFront` mm in front of fridge, oven, dishwasher |

### Step 2 — Read the validator

Read `packages/shared/src/validator.ts` in full. Identify:

- Which named checks/functions exist.
- Which violation kinds (`Violation['kind']`) are emitted.

Match them against the 8 spec checks. Any spec check without a corresponding
implementation is a **missing implementation**.

### Step 3 — Read the tests

Read `packages/shared/src/validator.test.ts`. For each spec check, find at
least one **positive** test (a valid layout that passes) and one **negative**
test (a layout that violates the rule and produces the expected violation).

A check with implementation but no negative test is a **missing test**.

### Step 4 — Print the audit report

```
/audit-validator — galley

  C1 Containment              [✅ impl] [✅ +test] [✅ −test]
  C2 No overlap               [✅ impl] [✅ +test] [❌ −test]
  C3 Wall adjacency           [✅ impl] [⚠️ +test] [❌ −test]
  C4 Fixed-point alignment    [✅ impl] [✅ +test] [✅ −test]
  C5 Door swing clear         [❌ impl] [—]        [—]
  C6 Walkway clearance        [✅ impl] [❌ +test] [❌ −test]
  C7 Work triangle            [✅ impl] [✅ +test] [✅ −test]
  C8 Appliance front          [✅ impl] [✅ +test] [✅ −test]

  Coverage: 6/8 fully covered
  Missing implementations: C5
  Missing tests: C2 −, C3 +/−, C6 +/−

  Legend: ✅ present  ⚠️ weak  ❌ missing  — n/a
```

### Step 5 — Offer fixes

For missing tests, offer to scaffold them:

> "Would you like me to add the missing test cases now? I'll add them as
> `it.skip(...)` placeholders with a TODO so you can fill in the geometry."

For missing implementations, do **not** auto-implement — implementations need
geometric care. Tell the user clearly:

> "C5 Door swing clear is declared in MVP.md § Layout Validator step 5 but is
> not implemented in `validator.ts`. Open a fix branch and implement
> `checkDoorSwingClear(input)` returning violations with `kind:
> "door_swing_blocked"` for any module footprint inside a door's arc."

### Step 6 — Run the tests

```bash
pnpm --filter @galley/shared test
```

Confirm zero failures. If failures exist, fix them before declaring the audit
done.
