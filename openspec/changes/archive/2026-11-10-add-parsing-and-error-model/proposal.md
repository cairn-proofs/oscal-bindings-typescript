## Why

This change is step 3 of the plan in #4, and it closes #8. The binding cannot read an OSCAL document yet. Each later
step needs a parsed document: serialization (#9), the facade (#11), and YAML (#13). The corpus cases of parsing and of
the error model stay in the list of expected failures until the binding has the parse operations.

## What Changes

1. Parse operations ([PRS-001] to [PRS-003]):
   1. `parse` reads a document from text or bytes and returns an `OscalDocument`.
   2. `parseFile` reads a document from a file path.
   3. One typed parser for each of the eight document types, for example `parseCatalog`. Each returns the wrapper of
      its type, for example `CatalogDocument`.
2. A non-raising validity check, `isValid` ([ERR-002]).
3. The error model ([ERR-001], [ERR-003] to [ERR-006]):
   1. A category type that holds the five categories of [ERR-001].
   2. Four error classes: `OscalError`, `ParseError`, `DocumentTypeMismatchError`, and `NotFoundError`. The
      mismatch class is a subclass of `ParseError`.
   3. A `ParseError` of a schema failure carries one structured entry for each failing location ([PRS-006]).
4. The root key of the input selects the one document type that the parse checks ([PRS-013]).
5. Each stage of a parse stops at its first decisive failure. The binding does no more work on input that is known
   to be invalid, except the entry collection that [PRS-006] requires.
6. A documented limit on the nesting depth of a JSON input: 250 levels ([PRS-010]). There is no limit on the count
   of entries ([PRS-011], [PRS-012]).
7. A pattern engine translates the OSCAL patterns that have a different meaning in the JavaScript regex engine
   ([PRS-007]). `README.md` documents the limit and the map of OSCAL patterns.
8. The conformance adapter connects the new operations, and the 14 corpus cases of `parse`, `parse-typed`, and
   `parse-file` leave the list of expected failures.
9. The traceability record gets one entry for each new operation ([SRF-003]).

The change is complete when the 14 cases pass and leave `test/conformance/expected-failures.json`. The `round-trip`
cases stay in the list, because they also need serialization (#9).

Not in this change:

1. The classes of the access-error and unknown-element-type categories. #11 and #10 add them with [ERR-007] and
   [ERR-008].
2. A category for a file read that fails for a reason other than a missing file. The contract defines no such category.
   cairn-proofs/oscal-bindings-specs#41 asks the store to define one. Until then, `parseFile` passes that error through
   unchanged.
3. The package entry point. #14 adds it.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the document-parsing and error-model capabilities and adds no
requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New files: `src/errors.ts`, `src/parse.ts`, and their tests.
2. Changed files: `src/validators.ts`, `test/support/adapter.ts`, `test/conformance/expected-failures.json`,
   `openspec/traceability.json`, and `README.md`.
3. No new dependency.
4. No consumer depends on this repo, so the change breaks no consumer.

[PRS-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-001-parse-an-oscal-document-from-text-or-bytes
[PRS-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-003-typed-parsers-return-the-matching-document-type-or-report-a-type-mismatch
[PRS-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-006-schema-validation-failures-carry-structured-error-detail
[PRS-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-007-regex-patterns-follow-a-defined-portability-rule
[PRS-010]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-010-a-binding-can-limit-the-resources-that-a-parse-uses
[PRS-011]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-011-a-binding-can-limit-the-structured-entries-of-a-parse-error
[PRS-012]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-012-a-parse-error-carries-each-entry-or-100-entries-or-more
[PRS-013]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-013-the-root-key-selects-the-document-type-of-the-parse-failures
[ERR-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-001-error-situations-map-to-a-fixed-taxonomy
[ERR-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-002-a-non-raising-validity-check-is-available
[ERR-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-003-parse-errors-expose-structured-validation-detail
[ERR-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-006-a-missing-file-is-a-not-found-error
[ERR-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-007-a-type-restricted-accessor-on-an-unsupported-document-type-is-an-access-error
[ERR-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-008-an-element-type-that-the-binding-does-not-recognize-is-an-unknown-element-type-error
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
