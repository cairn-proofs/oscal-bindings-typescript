## Why

This change is step 6 of the plan in #4, and it closes #11. A caller that reads the metadata, the OSCAL version, or the
body identifier of a parsed document must first find the root key of the document type. The path to the body is
different for each of the eight document types. The contract defines a facade that gives this access through one shape
([FAC-001], [FAC-002]), and the binding does not have it.

## What Changes

1. An `OscalDoc` class wraps a parsed OSCAL document of any of the eight types ([FAC-001]):
   1. The class gives the wrapper, the body, the metadata, the OSCAL version, and the body-level UUID through one
      shape ([FAC-002]).
   2. The class rejects a value that is not an OSCAL document wrapper with a `TypeError`.
2. `OscalDoc.fromJson` builds the facade from JSON text or bytes, and `OscalDoc.fromFile` builds it from a file path. Both
   use the parse operations and their errors ([FAC-003]).
3. The traceability record gets one entry for the `OscalDoc` type ([SRF-003]).

The change moves no corpus case. The corpus has no case for [FAC-001] to [FAC-003], so unit tests check their
scenarios. The `assessment-period/catalog` case stays in the list of expected failures. The assessment-period accessor
([FAC-004] to [FAC-006]) and the access error ([ERR-007]) are in #19, which
cairn-proofs/oscal-bindings-specs#43 blocks.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the document-facade capability, and adds no requirement of
its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New files: `src/document.ts` and its test.
2. Changed files: `openspec/traceability.json` and `README.md`.
3. No new dependency.
4. No consumer depends on this repo, so the change breaks no consumer.

[FAC-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-001-a-uniform-facade-wraps-any-document-type
[FAC-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-002-the-facade-reads-common-fields-without-type-branching
[FAC-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-003-the-facade-can-be-built-from-text-bytes-or-a-file
[FAC-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-004-the-assessment-period-accessor-is-restricted-to-assessment-plan-and-assessment-results
[FAC-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-006-the-assessment-period-of-assessment-results-aggregates-result-dates
[ERR-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-007-a-type-restricted-accessor-on-an-unsupported-document-type-is-an-access-error
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
