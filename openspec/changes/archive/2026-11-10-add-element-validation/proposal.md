## Why

This change is step 5 of the plan in #4, and it closes #10. The binding can validate a whole OSCAL document, but it
cannot validate a standalone element, such as an observation or a back-matter block. The 8 `element/*` corpus cases stay
in the list of expected failures until the binding has an element-validation operation.

## What Changes

1. A `validateElement` operation validates an element value against a named element type ([ELV-001]):
   1. The result states whether the element is valid, and lists one entry for each failing location.
   2. An element type that the binding does not recognize gives the unknown-element-type error ([ELV-003], [ERR-008]).
   3. The depth limit of the parse operations also applies to the element value.
2. A `supportedElementTypes` operation returns the sorted list of element-type names ([ELV-002]).
3. The conformance adapter connects `validateElement`, and the 8 `element/*` corpus cases leave the list of expected
   failures.
4. The traceability record gets one entry for each new operation ([SRF-003]).

The change is complete when the 8 cases pass and leave `test/conformance/expected-failures.json`. The
`assessment-period/catalog` case stays in the list, because it needs the document facade (#11).

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the element-validation capability and the error-model
capability, and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New files: `src/validate-element.ts` and its test.
2. Changed files: `src/errors.ts`, `src/validators.ts`, `src/parse.ts`, `test/support/adapter.ts`,
   `test/conformance/expected-failures.json`, `openspec/traceability.json`, and `README.md`.
3. No new dependency.
4. No consumer depends on this repo, so the change breaks no consumer.

[ELV-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-001-validate-a-standalone-element-against-a-named-type
[ELV-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-002-element-type-names-are-kebab-case-and-derived-from-the-type-names
[ELV-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-003-an-unknown-element-type-is-reported-not-silently-accepted
[ERR-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-008-an-element-type-that-the-binding-does-not-recognize-is-an-unknown-element-type-error
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
