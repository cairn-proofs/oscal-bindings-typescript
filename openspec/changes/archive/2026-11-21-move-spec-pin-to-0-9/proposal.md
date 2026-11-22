## Why

This change closes #64. The store published contract release `v0.9.0+oscal.1.2.3`. The binding pins
`v0.8.0+oscal.1.2.3`. #66, #67 and #68 implement the contract changes of the new release, and each of them is blocked
by this pin move. The new corpus has 358 cases, and the old corpus has 86.

When the pin moves with no other change, `npm test` gives 254 failures:

1. 240 corpus cases need the work of #66, #67 or #68.
2. Unit tests that read the corpus directly fail on the same cases. `test/conformance/expected-failures.json` does
   not apply to these tests.
3. Four failures come from the conformance runner, not from the binding:
   1. The runner does not know the new operation `yaml-parse-file`.
   2. The runner does not know `yaml-parse-typed`. The binding offers no typed YAML parser, and [YML-007] makes these
      parsers optional, so the [corpus README] says that the binding skips the operation.
   3. The runner requires a string for each bound of `expected-period`. The case
      `assessment-period/at-frequency-only` expects `null`, which the [corpus README] matches with any empty bound.
      The binding returns `undefined`, which [FAC-005] allows.
   4. A self-test of the runner uses the first case with the `bytes` input form, and expects a parse error. That case
      is now `round-trip/catalog-bytes`.
4. The generated files name the version of the spec artifact in their header.

Some new cases pass, but the runner does not check what they test. The runner ignores the `path` input form of
`round-trip` and `yaml-round-trip`, the `bytes` form of the second parse of `yaml-round-trip`, and the new field
`expected-absent-keys`. These cases test [PRS-002], [YML-006] and [YML-008], which the binding meets. The runner also
does not apply the category tree rule of [ERR-009], which the new corpus README adds for each case with
`expected-category`. Without these rules, the conformance run states a result that it did not check, so this change
includes them.

After this change, `test/conformance/expected-failures.json` lists 240 cases until #66, #67 and #68 land. `README.md`
states that the binding passes the conformance corpus, and the statement describes a release. So this change also
stops a release while the list has an entry.

## What Changes

1. The pin is release `v0.9.0+oscal.1.2.3`, with the sha256 of #64. The change moves it in `scripts/spec-artifact.ts`,
   `spec-pin.json` and `DEVELOPING.md`, and regenerates `src/generated/`.
2. `test/conformance/expected-failures.json` lists each case that the binding does not pass yet, with the issue that
   owns it: #66, #67 or #68.
3. The unit tests that read corpus cases do not use a case that `expected-failures.json` lists.
4. The conformance runner and the adapter:
   1. Run `yaml-parse-file` with the YAML parse-from-file operation `parseYamlFile`.
   2. Skip `yaml-parse-typed`.
   3. Match an empty bound with `null` in `expected-period`.
   4. Apply the `path` and `bytes` input forms of `round-trip` and `yaml-round-trip` as the [corpus README] states.
   5. Check `expected-absent-keys`.
   6. Check the category tree of [ERR-009] for each case with `expected-category`.
5. The runner self-tests use a parse case for the `bytes` input form, and show that each new rule fails when the
   binding gives a different result.
6. The job `tag-check` of `.github/workflows/build.yml` fails when `expected-failures.json` has an entry. `DEVELOPING.md`
   states the rule, describes the new list and describes the skipped operation.
7. The copy of the canonical JSON cases in `test/canonical-json.test.ts` has the four cases that the store adds, and the
   headers of both canonical JSON copies name the new tag.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the schema-versioning, yaml-documents, document-parsing, error-model and
document-facade capabilities, and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `scripts/spec-artifact.ts`, `spec-pin.json`, `src/generated/oscal.ts`,
   `src/generated/element-types.ts`, `test/support/runner.ts`, `test/support/adapter.ts`, `test/conformance.test.ts`,
   `test/runner.test.ts`, `test/parse.test.ts`, `test/document.test.ts`, `test/serialize.test.ts`,
   `test/validators.test.ts`, `test/canonical-json.test.ts`, `test/support/canonical-json.ts`,
   `test/conformance/expected-failures.json`, `.github/workflows/build.yml` and `DEVELOPING.md`.
2. The binding code does not change. The JSON Schema and the naming manifest of the new release are the same bytes as
   those of the old release, so only the header of the generated files changes.
3. No new dependency. The runner reads YAML with the `yaml` package, which the binding already uses.

[corpus README]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/corpus/1.2.3/README.md#operation-list
[FAC-005]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-facade/spec.md#requirement-fac-005-the-assessment-period-of-an-assessment-plan-aggregates-task-timing
[PRS-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-002-parse-an-oscal-document-from-a-file-path
[ERR-009]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/error-model/spec.md#requirement-err-009-error-categories-form-a-tree
[YML-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/yaml-documents/spec.md#requirement-yml-006-parse-an-oscal-document-from-a-yaml-file-path
[YML-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/yaml-documents/spec.md#requirement-yml-007-a-typed-yaml-parser-behaves-as-a-typed-json-parser
[YML-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/yaml-documents/spec.md#requirement-yml-008-serialize-an-oscal-document-to-yaml
