## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `src/errors.ts` defines the categories as classes, and the class tree is the category tree. A caller tests a
   category with `instanceof`. Design D1 of the archived change `2026-11-13-report-limit-exceeded-for-element-validation`
   made this choice.
2. Design D2 of the archived change `2026-11-11-add-backmatter-builders` states that a builder applies no rule of its
   own, and that the schema decides which input is invalid. A builder converts an invalid result of `validateElement`
   to a `ParseError` with the failures of the result. Risk 3 of that design expected a new category for builder errors.
3. `validateElement` throws a `LimitExceededError` for a value over the depth limit. It does not return that value as
   an invalid result. Design D5 of the archived change `2026-11-13-report-limit-exceeded-for-element-validation`
   decided that the limit-exceeded category is the end state for a builder value over the depth limit.
4. `test/support/runner.ts` rejects each operation in `PENDING_OPERATIONS` as unknown. `test/runner.test.ts` runs each
   case of an operation that is not pending against a conforming fake adapter, and expects each case to pass.
5. The `build-resource` cases of the corpus use two sets of fields. The cases of #30 use `key`, `title`,
   `identifier`, `expected-uuid`, and `expected-category`. The cases of #31 use `document-ids` or
   `expected-element`. A listed case that passes fails the run.

## Goals / Non-Goals

**Goals:**

1. A caller that catches `ParseError` does not catch a builder error.

**Non-Goals:**

1. The `build-hash` and `build-rlink` operations of the runner, and the `document-ids` and `expected-element` fields of
   `build-resource`. Issue #31 owns them.

## Decisions

### D1: The builder error

`ErrorCategory` adds `builder-error`. `src/errors.ts` adds this class:

```ts
/** A back-matter builder received invalid input (ERR-013). It is not a parse error. */
export class BuilderError extends OscalError {
  /** One entry for each failing location. The array is empty when the failure has no schema location. */
  readonly failures: readonly FailureEntry[];
  constructor(message: string, failures?: readonly FailureEntry[]);
}
```

The class extends `OscalError`, not `ParseError` ([ERR-013]). The doc comment of `ParseError` no longer names the
builders.

**Why:** Context item 1. A class outside the `ParseError` branch gives a false `instanceof ParseError` test with no
other code. The `failures` property keeps the schema failures that a builder reports now, so a caller does not lose
the failing locations.

**Alternative:** move `failures` to `OscalError`. Then each error has the property, also an error with no schema
failures, such as `NotFoundError`.

### D2: The key

`ResourceOptions` adds `key?: string`. `buildResource` sets the `uuid` before it builds the element:

1. A `key` and a `uuid` together: throw a `BuilderError` with no failures.
2. A `key` that is the empty string: throw a `BuilderError` with no failures.
3. A `key` and no `uuid`: the `uuid` is the UUID version 5 of the key (D3).
4. No `key` and no `uuid`: the `uuid` is a new UUID from `randomUUID`.
5. A `uuid` and no `key`: the `uuid` of the caller.

A field whose value is `undefined` is an omitted field, as for each other option. The key is not a field of the
resource, so the result has no `key`. The steps of design D2 of the archived builder change continue after step 5.

**Why:** [BMB-004] makes two rules that the schema cannot apply, because the key is not in the element. These rules
replace the statement of Context item 2 that a builder applies no rule of its own. The doc comment of
`src/backmatter.ts` changes to name the two rules.

### D3: The UUID version 5

A function in `src/backmatter.ts` that the module does not export computes the identifier as RFC 9562, Section 5.5
states:

1. Hash the 16 bytes of the namespace `3942257f-e1cf-5e06-9c6f-eeb97ecabe77`, then the UTF-8 bytes of the key, with
   `createHash("sha1")` of `node:crypto`.
2. Keep the first 16 bytes of the digest.
3. Set the high 4 bits of byte 6 to `0101`, and the high 2 bits of byte 8 to `10`.
4. Write the 16 bytes as lowercase hexadecimal digits in the groups 8-4-4-4-12.

The namespace is a constant in the module. The module does not derive the namespace again.

**Why:** `node:crypto` has SHA-1 and no UUID version 5 function. Ten lines of code give the identifier with no new
dependency. The corpus values `51beb3e9-30bb-535f-ba49-e68d4661aaa9` and `daa01937-2576-5dc8-9fb0-4da240946a5e`
check steps 1 to 4, and the second value has a key that is not ASCII.

**Alternative:** the `uuid` package. It adds a runtime dependency for one function.

### D4: Builder validation errors

The internal function `validated` of `src/backmatter.ts` throws a `BuilderError` that carries the failures of the
result, not a `ParseError`. A `LimitExceededError` of `validateElement` continues to pass through the builder with no
change.

**Why:** [ERR-013] applies to each validation error of `buildHash`, `buildRlink`, and `buildResource`. All three call
`validated`, so one change covers them. Context item 3 keeps the depth limit out of the builder-error category.

### D5: The runner

1. `Adapter` adds `buildResource(args: { key?: string; title?: string; identifier?: string }): unknown`.
   `test/support/adapter.ts` maps `identifier` to the `uuid` option and calls `buildResource`. The `Case` type of
   `test/support/runner.ts` adds the optional fields `arguments` (an object), `expected-uuid` (a string), and
   `expected-element`.
2. `runCase` adds the `build-resource` operation. `PENDING_OPERATIONS` and its doc comment do not name it.
3. A `build-resource` case with `expected-element`, or with a `document-ids` argument, fails with the message
   `pending: <field> (#31)`. The rule gives the arguments to the adapter only after this check, so the builder never
   gets a partial set of arguments.
4. With `expected-uuid`, the `uuid` of the result must equal `expected-uuid` as a string.
5. With `expected-category`, the builder must report that category, as for each other operation.
6. The runner exports `isPendingCase(c)`. It is true for a case of an operation in `PENDING_OPERATIONS`, and for a case
   of item 3.

**Why:** item 3 keeps the three cases of #31 failing for a stated reason (Context item 5). A runner that ignores
`document-ids` lets `build-resource/invalid-document-id` succeed for the wrong reason. Item 6 lets the runner tests
skip the same cases that the runner rejects. The corpus states the identifier in lowercase, and D3 writes lowercase, so
a string comparison is the rule.

**Alternative:** implement the `document-ids` and `expected-element` rules now. Issue #31 owns them.

### D6: Tests

1. `test/backmatter.test.ts`:
   1. The BMB-001.03 and BMB-003.03 tests expect a `BuilderError`, not a `ParseError`. The BMB-001.03 test keeps its
      check of a failure at `/algorithm`.
   2. ERR-013.01: `buildHash("abc", " SHA-256")` gives an error with the category `builder-error`.
   3. ERR-013.02: `buildResource` with a key and a `uuid` gives a `BuilderError` that is not an instance of
      `ParseError`.
   4. The depth test continues to expect a `LimitExceededError`.
2. `test/runner.test.ts`:
   1. The two tests of Context item 4 use `isPendingCase`. The test of each case skips each case for which
      `isPendingCase` is true. The pending test runs each case for which `isPendingCase` is true, and expects the
      message of an unknown operation or the message of D5 item 3.
   2. The conforming fake adapter returns `{ uuid: c["expected-uuid"] }` from `buildResource`. For a case with
      `expected-category`, it throws a `FakeError` with that category. It does not call the `fail` helper, because
      `fail` reads `c.input`, and a builder case has no `input`.
   3. The list of changed answers adds three entries: a `build-resource` case gives another `uuid`, a case with
      `expected-category` does not throw, and that case reports another category.

3. `test/security-notes.test.ts`: the test of the note "Check what you build or change" expects a `BuilderError` from
   `buildHash("abc", " SHA-256")`, not a `ParseError`.

The five corpus cases cover BMB-004.01 to BMB-004.05. The `build-resource/key-with-title` case expects the same
identifier as `build-resource/key`, so the two cases cover BMB-004.02. No unit test repeats a corpus case.

### D7: Documentation and traceability

1. In `## Status` of `README.md`:
   1. The builder item states the key, the two key errors, and that an invalid input gives a `BuilderError` that
      carries one entry for each failing location.
   2. The error-model item names `BuilderError`, and states that a `BuilderError` is not a `ParseError`.
   3. The conformance-runner item names the `build-resource` cases that pass.
2. In `## Security notes for consumers` of `README.md`:
   1. The "Error text" note states that a `BuilderError` also carries text of the input in `failures[].location` and
      `failures[].messages`.
   2. Item 3 of the "Size and time" note states that a `BuilderError` also has no limit on its entries.
3. `openspec/traceability.json`: `buildHash` and `buildRlink` add ERR-013. `buildResource` adds BMB-004 and ERR-013.

## Risks / Trade-offs

1. [A caller that catches `ParseError` around a builder no longer catches an invalid input] → no consumer depends on
   this repo. `README.md` names the new error.
2. [#31 and this change both edit the `build-resource` rule of the runner] → D5 item 3 names the fields that #31 adds.
   #31 replaces that check with its rules.

## Migration Plan

1. Implement the tasks on a feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.

[BMB-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-004-a-key-gives-the-resource-identifier
[ERR-013]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-013-invalid-input-to-a-back-matter-builder-is-a-builder-error
