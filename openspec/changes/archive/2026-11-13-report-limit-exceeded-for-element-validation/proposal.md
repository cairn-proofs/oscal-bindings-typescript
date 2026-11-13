## Why

This change closes #28. Contract release `v0.8.0+oscal.1.2.3` adds [ERR-009], [ERR-010], [ERR-011], and [ELV-004]. The
binding moved its pin to that release in #38. The binding does not meet these requirements yet:

1. The binding identifies its depth limit only in the message text of a `ParseError`. [ERR-010] requires a property
   that a caller can test.
2. A value deeper than the limit makes `validateElement` throw a `ParseError`. [ERR-011] requires the limit-exceeded
   category, and the error must not be a parse error.
3. No test shows that the category test of the binding follows the category tree of [ERR-009].

## What Changes

1. Each error of the binding has a `limit` property. The property identifies the documented limit that stopped the
   operation, and is `undefined` for each other error ([ERR-010]).
2. A parse over the depth limit continues to give a `ParseError` in the parse-error category ([ERR-004]). The error now
   carries the `limit` property.
3. **BREAKING:** A value over the depth limit makes `validateElement` throw a new `LimitExceededError`, not a
   `ParseError`. The error is in the limit-exceeded category, and carries the `limit` property ([ERR-011]). The
   back-matter builders validate through `validateElement`, so they throw the same error for a value over the limit.
4. `README.md` documents the limit of element validation ([ELV-004]), the `limit` property, and `instanceof` as the
   test for a category ([ERR-009]).
5. Tests cover scenarios ERR-009.01, ERR-009.02, ERR-010.02, ERR-011.01, ERR-011.02, and ERR-004.03.
6. The traceability record names the new requirements ([SRF-003]).

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the error-model capability and the element-validation
capability, and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `src/errors.ts`, `src/validators.ts`, `src/parse.ts`, `src/validate-element.ts`,
   `test/parse.test.ts`, `test/validate-element.test.ts`, `test/backmatter.test.ts`, `openspec/traceability.json`, and
   `README.md`.
2. No new dependency.
3. No consumer depends on this repo, so the breaking change of What Changes item 3 breaks no consumer.
4. No corpus case of the pinned release covers a limit, so `test/conformance/expected-failures.json` does not change.

[ERR-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-004-inputs-that-are-not-a-valid-document-are-a-parse-error
[ERR-009]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-009-error-categories-form-a-tree
[ERR-010]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-010-an-error-can-carry-portable-properties
[ERR-011]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-011-an-element-over-a-documented-limit-is-a-limit-exceeded-error
[ELV-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-004-a-binding-can-limit-the-resources-that-element-validation-uses
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
