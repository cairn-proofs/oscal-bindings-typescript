## Why

The goal of this repo is a TypeScript binding that implements the full contract of the store
cairn-proofs/oscal-bindings-specs (#4). This change is step 1 of the plan in #4. The spike of #1 pins release
`v0.2.0+oscal.1.2.3` and has no conformance runner. The latest release is `v0.7.0+oscal.1.2.3`. Its release notes
require each conformance runner to read the new case field `expected-max-failures`
(cairn-proofs/oscal-bindings-specs#34, cairn-proofs/oscal-bindings-specs#35). Each later change of the binding needs a
measure of progress against the corpus. This change adds that measure before the binding has any operation.

## What Changes

1. The toolchain moves to the current releases:
   1. Node `26.13.0` LTS, which is also the pin of the store.
   2. The OpenSpec CLI `1.17.0`.
   3. `@types/node` `26.6.6`.
2. The spec artifact pin moves from `0.2.0+oscal.1.2.3` to `0.7.0+oscal.1.2.3`, with sha256
   `39f61f5c40200882106d9df6367d5aa5ccc6d604288741a8a70e93e119fa933e`. The generator writes the types again from
   the new artifact.
3. A conformance runner runs each case of `corpus/1.2.3/cases.json` of the pinned artifact as one test. It compares
   results as the corpus README defines, including `expected-min-failures` and `expected-max-failures`.
4. The repo keeps its own list of expected conformance failures, as [VER-007] requires. A listed case that passes
   fails the run. A listed case that is not in the pinned corpus also fails the run. At the start, the binding has no
   operation, so the list holds each case.
5. The repo keeps a traceability record that conforms to the JSON Schema of [SRF-007]. Each contract identifier in the
   record must resolve in the requirement index of the pinned artifact, as [SRF-004] requires. At the start, the
   binding exports no operation, so the record holds no entry.
6. The README states the new pin and the conformance status.

Not in this change: an operation of the binding, a change of the package layout, the package entry point, and a
published npm package. Each later change adds operations and removes cases from the list of expected failures.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes [VER-005], [VER-007], [SRF-003], [SRF-004], and [SRF-007],
and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `mise.toml`, `mise.lock`, `.mise/locks/`, `package.json`, `package-lock.json`,
   `scripts/spec-artifact.ts`, `src/generated/oscal.ts`, `README.md`, and the existing tests.
2. New files: the conformance runner and its tests, the canonical JSON comparison, the list of expected failures, the
   traceability record `openspec/traceability.json`, and the traceability test.
3. No new npm dependency. The runner uses `node:test` through `tsx`, and `ajv`, which the spike already pins.
4. The check gate still downloads one release asset from cairn-proofs/oscal-bindings-specs over HTTPS.
5. No consumer depends on this repo, so the change breaks no consumer.

[VER-005]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/schema-versioning/spec.md#requirement-ver-005-spec-artifacts-are-distributed-pinned-and-hash-verified
[VER-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/schema-versioning/spec.md#requirement-ver-007-each-binding-keeps-its-own-expected-conformance-failures
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
[SRF-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-004-contract-identifiers-in-a-traceability-record-resolve-in-the-requirement-index
[SRF-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-007-the-store-publishes-a-json-schema-for-the-traceability-record
