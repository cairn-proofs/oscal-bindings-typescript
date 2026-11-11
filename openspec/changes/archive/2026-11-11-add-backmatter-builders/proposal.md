## Why

This change is step 7 of the plan in #4, and it closes #12. A caller that adds a hash, an rlink, or a resource to the
back-matter of a document must write each field by hand and validate the result. The contract defines builders that do
this work ([BMB-001], [BMB-002], [BMB-003]), and the binding does not have them.

## What Changes

1. `buildHash` builds a hash element from a digest value and an algorithm. The algorithm is SHA-256 when the caller
   omits it ([BMB-001]).
2. `buildRlink` builds an rlink element from a target reference, an optional media type, and an optional list of
   hashes ([BMB-002]).
3. `buildResource` builds a back-matter resource from an optional title, description, list of rlinks, identifier, and
   list of document identifiers. It generates a UUID when the caller omits the identifier ([BMB-003]).
4. Each builder validates its result. An invalid input gives a `ParseError` that carries one entry for each failing
   location. An omitted optional input is absent from the result.
5. The traceability record gets one entry for each builder ([SRF-003]).

The change moves no corpus case. The corpus has no case for [BMB-001] to [BMB-003], so unit tests cover their
scenarios. cairn-proofs/oscal-bindings-specs#45 asks for corpus cases.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the backmatter-builders capability, and adds no requirement
of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New files: `src/backmatter.ts` and its test.
2. Changed files: `openspec/traceability.json` and `README.md`.
3. No new dependency.
4. No consumer depends on this repo, so the change breaks no consumer.

[BMB-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-001-build-a-back-matter-hash-value
[BMB-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-002-build-a-back-matter-rlink-value
[BMB-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-003-build-a-back-matter-resource-value
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
