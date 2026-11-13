## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `test/support/adapter.ts` is the only module of the harness that imports the binding. The `Adapter` interface has no
   function for the supported element types.
2. `runCase` in `test/support/runner.ts` fails a case whose operation it does not know. `PENDING_OPERATIONS` names each
   such operation, and holds `element-types`.
3. `test/runner.test.ts` runs each case that is not pending through a fake adapter that answers from the corpus data.
   Then it changes one answer of the fake adapter, and checks that the case fails.
4. The `element-types` case has no `input`. Its `expected` field is the path of a JSON array of names.

## Goals / Non-Goals

**Goals:**

1. The harness runs `element-types/all` with the rule of the corpus README for the `element-types` operation.

**Non-Goals:**

1. A change to `supportedElementTypes` or to its unit test.

## Decisions

### D1: The adapter function

The `Adapter` interface adds this function:

```ts
/** ELV-002: the list of supported element-type names. */
elementTypes(): readonly string[];
```

The adapter connects it to `supportedElementTypes`.

### D2: The runner rule

`runCase` adds a case for the `element-types` operation. It reads the array at `expected`, and compares it with
`adapter.elementTypes()` by `assert.deepEqual`. The comparison fails when an item is missing, added, or in a different
position. `PENDING_OPERATIONS` and its doc comment do not name `element-types`.

**Why:** a deep equality of two arrays is the rule "item by item and in the same order". The assertion message shows
the first difference.

**Alternative:** compare the canonical JSON bytes of the two lists, as a round trip does. The corpus README states an
item comparison, not a byte comparison, for this operation.

### D3: Runner tests

In `test/runner.test.ts`:

1. The conforming fake adapter returns the array at `expected` from `elementTypes`.
2. The list of changed answers adds three entries for the first `element-types` case:
   1. The list has one name less.
   2. The list has one more name.
   3. Two names change position.

## Risks / Trade-offs

None.

## Migration Plan

1. Implement the tasks on the feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.
