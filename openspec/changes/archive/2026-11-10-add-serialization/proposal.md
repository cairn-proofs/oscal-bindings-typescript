## Why

This change is step 4 of the plan in #4, and it closes #9. The binding can parse an OSCAL document, but it cannot write
one. The `round-trip` corpus cases stay in the list of expected failures until the binding has a serialize operation.

## What Changes

1. A `serialize` operation writes a parsed or typed OSCAL document to OSCAL JSON text:
   1. The output uses OSCAL property keys ([SER-001]).
   2. The output omits each absent field ([SER-002]).
   3. The default output has indents. A `compact` option gives the form without whitespace ([SER-003]).
   4. The output for a parsed document is equivalent to its input ([SER-004]).
   5. Each datetime keeps its instant, its offset, and each fraction digit ([SER-005]).
2. The conformance adapter connects `serialize`, and the 12 `round-trip` corpus cases leave the list of expected
   failures.
3. The traceability record gets one entry for `serialize` ([SRF-003]).

The change is complete when the 12 cases pass and leave `test/conformance/expected-failures.json`. The
`yaml-round-trip` cases stay in the list, because they also need YAML (#13).

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the serialization capability and adds no requirement of its
own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New files: `src/serialize.ts` and its test.
2. Changed files: `test/support/adapter.ts`, `test/conformance/expected-failures.json`, `openspec/traceability.json`,
   and `README.md`.
3. No new dependency.
4. No consumer depends on this repo, so the change breaks no consumer.

[SER-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-001-serialization-emits-oscal-property-keys
[SER-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-002-serialization-never-emits-null
[SER-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-003-pretty-output-by-default-compact-output-on-request
[SER-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-004-round-trip-equivalence-uses-the-shared-canonical-form
[SER-005]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-005-a-datetime-keeps-its-instant-and-offset
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
