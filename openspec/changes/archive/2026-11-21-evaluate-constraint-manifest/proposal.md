## Why

This change closes #66. Release `v0.9.0+oscal.1.2.3` of the contract adds the capability `constraint-validation`. A
document is conformant only when it conforms to the schema and meets the constraint manifest
`manifest/1.2.3/constraints.json` ([CNS-017]). The binding checks the schema only. It accepts each document that
breaks a constraint, for example a property of the OSCAL namespace with a name that OSCAL does not allow.

The pin move of #64 lists the 236 corpus cases of this issue in `test/conformance/expected-failures.json`. The binding
cannot be released while that list has an entry.

## What Changes

1. A parse operation reports a parse error for a document that conforms to the schema and does not meet the manifest
   ([PRS-015], [ERR-004.05]). This applies to `parse`, `parseFile`, `parseYaml`, `parseYamlFile` and the typed
   parsers. The parse error has one failure entry for each constraint failure, and each entry has the `id` of its
   manifest entry. A document that does not conform to the schema gives no constraint entry.
2. `isValid` returns false for such a document ([ERR-002], [PRS-015.03]).
3. **BREAKING:** some documents that parsed before now give a parse error. A caller that reads the failure entries
   sees one new optional field, `constraint`.
4. The binding evaluates the manifest with its own evaluator of the RFC 9535 queries that the manifest uses
   ([CNS-006] to [CNS-017], [CNS-024], [CNS-025]). The evaluator throws when it reads a query outside that syntax, and
   a test compiles each query of the pinned manifest. The binding does not implement Metapath, and it does nothing for
   the constraints of `constraint-exclusions.json`.
5. The binding ships the manifest. `scripts/spec-artifact.ts` adds the manifest and its JSON Schema to the members that
   the binding reads, and `npm run generate` copies the manifest into `src/generated/`.
6. The conformance runner applies the rule of `expected-constraints` for a `parse` case. The `id` values of the
   constraint failures in the parse error must equal the list, with each repeat. A self-test of the runner fails when
   the `id` values differ.
7. `test/conformance/expected-failures.json` loses the 236 entries of #66.
8. `README.md`, `DEVELOPING.md`, `PERFORMANCE.md`, `docs/limits.md` and `docs/security.md` state the new behavior and its cost.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the constraint-validation, document-parsing and error-model
capabilities, and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New files: `src/constraints.ts`, `src/generated/constraints.json` and `test/constraints.test.ts`.
2. Changed files: `src/parse.ts`, `src/errors.ts`, `scripts/spec-artifact.ts`, `scripts/generate.ts`,
   `test/support/runner.ts`, `test/support/adapter.ts`, `test/runner.test.ts`, `test/spec-artifact.test.ts`,
   `test/yaml.test.ts`, `test/conformance/expected-failures.json`, `openspec/traceability.json`, `README.md`,
   `DEVELOPING.md`, `PERFORMANCE.md`, `docs/limits.md` and `docs/security.md`.
3. No new dependency. The evaluator uses no RFC 9535 library.
4. The cost of a parse grows. The evaluator adds 0.1 ms to 0.2 ms to the parse of a document of 22 KiB or less. On the
   10 MiB catalog of SP 800-53, a parse takes 17 ms and the evaluator adds about 70 ms. [design.md, D2](design.md#d2-the-evaluator-compiles-the-rfc-9535-syntax-that-the-manifest-uses)
   has the numbers and the alternative.
5. The package grows by the manifest, about 600 KB.
6. The change does not set the package version. The release notes of the next release list the break.
7. Not in this change: element validation and the builders, which #68 owns ([CNS-018]).

[CNS-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-006-the-manifest-selects-nodes-with-rfc-9535-queries
[CNS-017]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-017-a-document-meets-the-manifest-when-no-entry-fails-for-it
[CNS-018]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-018-an-element-meets-the-manifest-when-no-entry-that-it-can-decide-fails
[CNS-024]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-024-the-location-of-a-node-says-when-two-selections-are-the-same-node
[CNS-025]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-025-an-allowed-values-entry-compares-values-character-for-character
[ERR-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/error-model/spec.md#requirement-err-002-a-non-raising-validity-check-is-available
[ERR-004.05]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/error-model/spec.md#requirement-err-004-inputs-that-are-not-a-valid-document-are-a-parse-error
[PRS-015]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-015-a-constraint-failure-is-a-parse-failure-that-names-its-constraint
[PRS-015.03]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-015-a-constraint-failure-is-a-parse-failure-that-names-its-constraint
