## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `src/errors.ts` defines the categories as classes. `DocumentTypeMismatchError` extends `ParseError`, so a caller that
   catches `ParseError` also catches a mismatch. Design D2 of the archived change
   `2026-11-10-add-parsing-and-error-model` made this choice. The `category` property holds one string, the most
   specific category of the error.
2. `ParseError` takes the category as an optional third constructor argument. Only `DocumentTypeMismatchError` uses it.
3. `assertWithinDepthLimit` in `src/validators.ts` throws a `ParseError` that names the limit in its message. The parse
   pipeline and `validateElement` both call it.
4. The back-matter builders call `validateElement`, so a value over the depth limit stops a builder with the error of
   `validateElement`.
5. `test/parse.test.ts` already checks that a mismatch is an instance of `ParseError`. No test checks that a parse
   error of another kind is not an instance of `DocumentTypeMismatchError`.

## Goals / Non-Goals

**Goals:**

1. A caller tests a category and the limit property with plain TypeScript, with no helper function.

**Non-Goals:**

1. The read-error and builder-error categories of [ERR-001]. Issues #29 and #30 own them.
2. A second limit, or a change to the value of the depth limit.

## Decisions

### D1: The category test is `instanceof`

A caller tests whether an error is in a category with `instanceof` and the class of that category ([ERR-009]). The class
tree is the category tree, so the test is true for a subcategory and false for a parent. The `category` property
continues to hold the most specific category. `README.md` states both facts, and names the classes. The
`access-error` category has no class, because no operation of the binding reports it. The change that adds the first
error of a category adds its class.

**Why:** the class tree of Context item 1 already meets [ERR-009]. The change only documents the test and adds the
tests of D6.

**Alternative:** an `isInCategory(error, category)` function. It repeats the class tree in a second structure that can
differ from it.

### D2: The limit property

`src/errors.ts` adds a type and a property on the base class:

```ts
/** The documented limits of the binding (ERR-010). */
export type Limit = "nesting-depth";

export class OscalError extends Error {
  readonly category: ErrorCategory;
  /** The documented limit that stopped the operation, or `undefined` when no limit stopped it (ERR-010). */
  readonly limit: Limit | undefined;
}
```

The `OscalError` constructor takes the limit as an optional third argument. A caller tests for the property with
`error.limit !== undefined`. Each error has the `limit` key, so `"limit" in error` is not the test. `README.md` states
the test.

**Why:** [ERR-010] makes a property independent of the category, so the base class holds it. The string identifies the
limit. `README.md` states the value that the string identifies.

**Alternative:** an object with the name and the value of the limit. A caller cannot change the value, and `README.md`
documents it, so the object adds no information.

### D3: The limit-exceeded error

`ErrorCategory` adds `limit-exceeded`. `src/errors.ts` adds this class:

```ts
/** Element validation stopped at a documented limit (ERR-011). It is not a parse error. */
export class LimitExceededError extends OscalError {
  declare readonly limit: Limit;
  constructor(limit: Limit, message: string);
}
```

The class extends `OscalError`, not `ParseError` ([ERR-011]). The `ParseError` constructor changes its third argument
to an options object, `{ category?: ErrorCategory; limit?: Limit }`, so that a parse error can carry a limit and
`DocumentTypeMismatchError` can continue to set its category.

**Why:** the type of `limit` is `Limit` on this class, so a caller that catches `LimitExceededError` reads the limit
with no check for `undefined`. The options object keeps the two optional arguments independent.

**Alternative:** a fourth positional argument on `ParseError`. A caller that sets only the limit then passes the
category argument as `undefined`.

### D4: The depth check

`src/validators.ts` replaces `assertWithinDepthLimit` with two exports: `exceedsDepthLimit(value)` and the message
text of the limit. Each caller throws its own error:

1. The parse pipeline throws a `ParseError` with no failure entries and the limit `nesting-depth` ([ERR-004],
   [ERR-010]).
2. `validateElement` throws a `LimitExceededError` with the limit `nesting-depth` ([ELV-004] item 2, [ERR-011]).

The walk, the value of 250 levels, and the message text do not change.

**Why:** the two operations need errors of two classes. The walk stays in one place, so the two operations apply the
same limit.

**Alternative:** pass an error factory to `assertWithinDepthLimit`. It adds a parameter that only two callers use.

### D5: The back-matter builders

The builders do not change. A value over the depth limit makes a builder throw the `LimitExceededError` of
`validateElement`. `README.md` states this.

**Why:** Context item 4. A builder catches no error of `validateElement` now, and the change keeps it that way. The
limit-exceeded category is the end state for a builder value over the depth limit. The builder-error category of #30
does not apply to it.

### D6: Tests

The tests name the scenario that they check:

1. `test/parse.test.ts`:
   1. ERR-009.01: a mismatch is an instance of `DocumentTypeMismatchError` and of `ParseError`. The existing test
      `parseCatalog on a profile with an invalid body is a document type mismatch` checks this, so the change adds
      the scenario identifier to its name, and adds no test.
   2. ERR-009.02: input that is not valid JSON gives a `ParseError` that is not an instance of
      `DocumentTypeMismatchError`.
   3. ERR-004.03: a valid document over the depth limit gives a `ParseError` with category `parse-error` and limit
      `nesting-depth`.
   4. ERR-010.02: a document that fails schema validation gives a `ParseError` whose limit is `undefined`.
2. `test/validate-element.test.ts`:
   1. ERR-011.01: a value deeper than 250 levels gives a `LimitExceededError` with category `limit-exceeded` and limit
      `nesting-depth`. A value that refers to itself gives the same error.
   2. ERR-011.02: the same error is not an instance of `ParseError`.
3. `test/backmatter.test.ts`: a builder value deeper than 250 levels gives a `LimitExceededError`.

The existing depth tests of `test/parse.test.ts` and `test/validate-element.test.ts` change to these expectations, and
do not stay as duplicates.

### D7: Documentation in `README.md`

1. The `## Status` item of the error model names `LimitExceededError`. It states that `instanceof` tests a category
   (D1), and that the `limit` property identifies the limit that stopped an operation. It states the test
   `error.limit !== undefined` (D2).
2. The `## Limits` section states the error of each operation over the depth limit. A parse operation gives a
   `ParseError`. `validateElement` and the builders give a `LimitExceededError`. Each error carries the limit
   `nesting-depth`. `isValid` continues to return false. This section is the documentation of [ELV-004].

### D8: Traceability

`openspec/traceability.json` adds these identifiers:

1. `parse`: ERR-009 and ERR-010.
2. Each typed parser: ERR-009.
3. `validateElement`: ELV-004, ERR-010, and ERR-011.

## Risks / Trade-offs

1. [A caller that catches `ParseError` around `validateElement` or a builder no longer catches the depth error] → no
   consumer depends on this repo. `README.md` names the new error for each operation.

## Migration Plan

1. Implement the tasks on a feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.

[ERR-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-001-error-situations-map-to-a-fixed-taxonomy
[ERR-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-004-inputs-that-are-not-a-valid-document-are-a-parse-error
[ERR-009]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-009-error-categories-form-a-tree
[ERR-010]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-010-an-error-can-carry-portable-properties
[ERR-011]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-011-an-element-over-a-documented-limit-is-a-limit-exceeded-error
[ELV-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-004-a-binding-can-limit-the-resources-that-element-validation-uses
