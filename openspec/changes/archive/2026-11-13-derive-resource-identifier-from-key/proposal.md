## Why

This change closes #30. Contract release `v0.8.0+oscal.1.2.3` adds [BMB-004] and [ERR-013], and changes [BMB-003] and
[ERR-001]. The binding moved its pin to that release in #38. The binding does not meet these requirements yet:

1. `buildResource` has no key input. [BMB-003] and [BMB-004] require a key that gives the resource identifier.
2. A back-matter builder throws a `ParseError` for invalid input. [ERR-013] requires the builder-error category of
   [ERR-001], and the error must not be a parse error.
3. The corpus runner does not run the `build-resource` operation. The five `build-resource/*` cases of [BMB-004] are in
   `test/conformance/expected-failures.json`.

## What Changes

1. `buildResource` accepts an optional `key`. When the caller gives a key and no `uuid`, the `uuid` of the resource is
   the UUID version 5 of the key ([BMB-004]). The builder generates a new `uuid` only when the caller gives no `uuid`
   and no key ([BMB-003]).
2. An empty key, or a key with a `uuid`, makes `buildResource` throw a builder error ([BMB-004]).
3. **BREAKING:** For invalid input, `buildHash`, `buildRlink`, and `buildResource` throw a new `BuilderError`, not a
   `ParseError`. The error is in the builder-error category, and it is not a parse error ([ERR-013]). A value over the
   depth limit continues to give a `LimitExceededError`.
4. The corpus runner runs the `build-resource` cases that compare `expected-uuid` or check `expected-category` with the
   arguments `key`, `title`, and `identifier`. The five cases of #30 leave `test/conformance/expected-failures.json`.
   The `build-resource` cases that need `expected-element` or `document-ids` stay in the list for #31.
5. Tests cover scenarios ERR-013.01 and ERR-013.02. The corpus cases cover BMB-004.01 to BMB-004.05.
6. `README.md` and the traceability record name the key and `BuilderError` ([SRF-003]). The security notes of
   `README.md` name `BuilderError` as an error that carries text of the input.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the backmatter-builders capability and the error-model
capability, and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `src/errors.ts`, `src/backmatter.ts`, `test/backmatter.test.ts`, `test/security-notes.test.ts`,
   `test/support/adapter.ts`, `test/support/runner.ts`, `test/runner.test.ts`,
   `test/conformance/expected-failures.json`, `openspec/traceability.json`, and `README.md`.
2. No new dependency. The UUID version 5 uses SHA-1 from `node:crypto`.
3. No consumer depends on this repo, so the breaking change of What Changes item 3 breaks no consumer.

[BMB-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-003-build-a-back-matter-resource-value
[BMB-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-004-a-key-gives-the-resource-identifier
[ERR-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-001-error-situations-map-to-a-fixed-taxonomy
[ERR-013]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-013-invalid-input-to-a-back-matter-builder-is-a-builder-error
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
