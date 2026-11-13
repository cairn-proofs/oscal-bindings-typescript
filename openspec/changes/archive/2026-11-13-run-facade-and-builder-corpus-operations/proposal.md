## Why

This change closes #31. Contract release `v0.8.0+oscal.1.2.3` adds corpus cases for [FAC-001] to [FAC-003] and
[BMB-001] to [BMB-003]. The binding moved its pin to that release in #38. The binding already has the document facade
`OscalDoc` and the builders `buildHash`, `buildRlink`, and `buildResource`. But the conformance runner does not know
the `facade`, `build-hash`, and `build-rlink` operations, and it does not know the `build-resource` fields
`expected-element` and `document-ids`. So `test/conformance/expected-failures.json` lists 18 cases, and no test runs
them.

## What Changes

1. The conformance adapter connects the `facade` operation to `OscalDoc`, for each of the three constructions: from
   the parsed document, from the raw bytes, and from the path.
2. The conformance adapter connects `build-hash` to `buildHash` and `build-rlink` to `buildRlink`. The adapter gives
   `document-ids` to `buildResource`.
3. The conformance runner runs the `facade`, `build-hash`, and `build-rlink` operations, and the `build-resource` fields
   `expected-element` and `document-ids`, with the rules of `corpus/1.2.3/README.md`.
4. The runner gives each item of `hashes` and `document-ids` to the builder without validation.
5. `test/conformance/expected-failures.json` does not list the 18 cases.
6. `test/runner.test.ts` shows that the runner fails each new rule when the binding gives a different result.
7. `README.md` names the new cases in the list of conformance cases that pass.

The cases `build-hash/off-list-algorithm` and `build-hash/invalid-algorithm` check [BMB-001.04] and [BMB-001.03].
`buildHash` already accepts `SHA-999` and rejects ` SHA-256` with a `BuilderError`, so these cases pass with no change
to the binding.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the document-facade and backmatter-builders capabilities,
and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `test/support/adapter.ts`, `test/support/runner.ts`, `test/runner.test.ts`,
   `test/conformance/expected-failures.json`, and `README.md`.
2. The binding code does not change. `openspec/traceability.json` already names FAC-001 to FAC-003 and BMB-001 to
   BMB-003.
3. No new dependency.

[FAC-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-001-a-uniform-facade-wraps-any-document-type
[FAC-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-003-the-facade-can-be-built-from-text-bytes-or-a-file
[BMB-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-001-build-a-back-matter-hash-value
[BMB-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-003-build-a-back-matter-resource-value
[BMB-001.03]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#scenario-bmb-00103-invalid-algorithm-reports-a-validation-error
[BMB-001.04]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#scenario-bmb-00104-an-algorithm-that-is-not-a-named-algorithm-is-accepted
