## Context

See [proposal.md, Why](proposal.md#why). These constraints shape the approach:

1. The archived spike change [spike-types-from-manifest](../archive/2026-10-19-spike-types-from-manifest/design.md)
   gives the toolchain, the pinned fetch, the manifest validator, and the type generator. This change keeps them.
2. The release `v0.7.0+oscal.1.2.3` holds `corpus/1.2.3/` with 58 cases in eight operations, `docs/canonical-json.md`,
   `openspec/requirements.json`, and `openspec/traceability.schema.json`. The spike extracts only part of the corpus.
3. Between the tags `v0.2.0+oscal.1.2.3` and `v0.7.0+oscal.1.2.3`, the manifest and the schema files are the same
   bytes.
4. The corpus README defines each operation, each case field, and the five error categories. The canonical JSON
   document defines the comparison of a round trip.
5. cairn-proofs/oscal-bindings-python has a conformance runner, a list of expected failures, and a traceability test.
   This design follows that binding where TypeScript permits it. The relevant source is its archived change
   `add-conformance-runner`, `tests/test_conformance.py`, `tests/support/expected_failures.py`, and
   `tests/test_traceability.py`.
6. The binding has no operation and no package entry point yet.
7. `npm test` runs only the files that match `test/*.test.ts`.

## Goals / Non-Goals

**Goals:**

1. One test for each corpus case, named by the case id, so that a failure names the case.
2. A pinned, hash-checked input. No test reads an unpinned copy of the store.
3. A list of expected failures that is explicit and that clears itself: a fix makes the run fail until its entry is
   removed.
4. One place that later changes edit to connect a binding operation to the runner.
5. A runner whose checks are shown to pass and to fail before the binding has an operation.

**Non-Goals:**

1. An operation of the binding. Each later change adds operations.
2. A change to the package layout or to the spike tools `type-fixtures` and `global-names`.
3. A check that the record covers each exported name. The change that adds the package entry point adds that check.
4. A run of the corpus from a local checkout of the store.

## Decisions

### D1: Pin the latest release of each tool

Each tool pin is the latest release on 2026-11-09:

1. Node `26.13.0` LTS in `mise.toml` and in `engines.node` of `package.json`.
2. The OpenSpec CLI `1.17.0` in `mise.toml`.
3. `@types/node` `26.6.6` in `package.json`.

`typescript` `7.0.2`, `tsx` `4.23.15`, and `ajv` `8.20.0` are already the latest releases. `mise lock` writes
`mise.lock` and the sidecar directory in `.mise/locks/` again. The CI workflow does not change, because `mise-action`
reads `mise.toml` and `mise.lock`.

### D2: Move the pin and extract the full corpus and the contract index

`scripts/spec-artifact.ts` sets the version `0.7.0+oscal.1.2.3` and the sha256 together. In the member list,
`corpus/1.2.3` replaces `corpus/1.2.3/documents`, and the list adds `openspec/requirements.json` and
`openspec/traceability.schema.json`. `artifactPaths()` adds the keys `corpus`, `cases`, `requirements`, and
`traceabilitySchema`. It keeps `documents`, which `scripts/type-fixtures.ts` reads.

The generator then writes `src/generated/oscal.ts` again. Because the manifest and the schema did not change (Context,
item 3), the only changed line is the artifact version in the header comment.

1. **Why:** the cache directory name holds the version and the start of the hash, so the new pin never reads an old
   tree. The runner needs `cases.json`, `expected/`, and `elements/`. The traceability test needs the index and the
   JSON Schema.

### D3: Generate one `node:test` test for each case

`test/conformance.test.ts` calls the spike function `ensureSpecArtifact()` with a top-level `await`. It then reads
`cases.json` and registers one `test()` for each case, with the case id as the name. A failed fetch or a failed hash
check fails the run. It does not skip.

1. **Why:** `node:test` through `tsx --test` adds no dependency, and the spike already uses it. The case id as the test
   name gives the same result as the parametrized tests of the Python binding.

### D4: Connect the binding through an adapter of binding operations

`test/support/adapter.ts` exports one function for each binding operation that the corpus uses, and one function that
maps an error to a corpus category:

1. `parse(input)`: the generic parse of [PRS-001]. `input` is a `string` or a `Uint8Array`.
2. `parseTyped(documentType, input)`: the typed parse of [PRS-003] for the root key `documentType`.
3. `parseFile(path)`: the parse of [PRS-002].
4. `serialize(document)`: the JSON serialization of the serialization capability.
5. `isValid(input)`: the validity check of [ERR-002].
6. `validateElement(elementType, value)`: the element validation of [ELV-001].
7. `assessmentPeriod(document)`: the accessor of [FAC-004] on the facade of the parsed document.
8. `parseYaml(input)` and `serializeYaml(document)`: the operations of [YML-005] and [YML-008].
9. `category(error)` and `failureCount(error)`: the corpus category of an error and the count of its structured
   entries.

At the start, each function throws a `NotImplemented` error. Only the adapter imports the binding.

`test/support/runner.ts` composes these functions for each corpus operation, as the corpus README defines it:

1. `round-trip`: `parse` and `parseTyped` with `document-type` both succeed. The canonical form of `serialize` of the
   parsed document is the same bytes as the `expected` file. `isValid` returns true.
2. `parse`: `parse` reports `expected-category`, and `isValid` returns false.
3. `parse-typed`: `parseTyped` with `document-type` reports `expected-category`.
4. `parse-file`: `parseFile` with the input path joined to the absolute corpus directory reports `expected-category`,
   and the error message holds that path.
5. `assessment-period`: `assessmentPeriod` of the parsed input reports `expected-category`.
6. `validate-element`: for a case with `expected-valid`, `validateElement` returns that validity result. For a case
   with `expected-category`, `validateElement` reports that category.
7. `yaml-round-trip`: the canonical form of `serialize` of the `parseYaml` result is the same bytes as `expected`. Then
   `serializeYaml` of that result, `parseYaml` of the YAML output, and `serialize` give a JSON output with the same
   canonical form.
8. `yaml-parse`: `parseYaml` reports `expected-category`.

For `parse` and `yaml-parse`, `failureCount` is at least `expected-min-failures` when the case has that field. For
`parse`, it is at most `expected-max-failures` when the case has that field. A case with `input-form: bytes` gives the
input as a `Uint8Array`. Each other case gives the input as a `string`.

1. **Why:** the runner holds the rules of the corpus README, so a later change only connects a binding operation in the
   adapter. The Python runner has the same split.

### D5: Keep the expected failures in a JSON file of this repo

`test/conformance/expected-failures.json` maps each case id to a reason. At the start, the reason of each case is
`not implemented`. A later change sets an issue URL as the reason for a real defect. A listed case runs in full, and the
runner applies these rules:

1. A listed case that fails passes the test.
2. A listed case that passes fails the test, and the message tells the developer to remove the entry.
3. A listed id that is not in the pinned corpus fails the run.

1. **Why:** [VER-007] puts the list in the binding. The list makes the state of conformance visible in review. Each
   later change removes the lines of the cases that it makes pass.
2. **Alternative considered:** skip each case whose adapter function throws `NotImplemented`. Rejected: a skip hides
   the state of conformance, and an implemented operation that throws `NotImplemented` by mistake then passes silently.
3. **Alternative considered:** a TypeScript module, as the Python binding has. Rejected: a JSON file holds data only,
   and no code can compute an entry.

### D6: Test the runner with a fake adapter that conforms

The list of D5 holds each case at the start, so a defect in a check of D4 does not fail the conformance run.
`test/runner.test.ts` therefore runs the runner of D4 with a fake adapter. The fake adapter takes its answers from the
corpus: it returns the bytes of the `expected` file, throws an error of the expected category with the expected count
of entries, and returns the expected validity result. With the fake adapter, each case passes. For each check of D4, a
second fake adapter changes one answer, and the case fails. The test also applies the three rules of D5 to a sample
list.

1. **Why:** each check of the runner is then shown to pass and to fail before the binding has an operation.

### D7: Copy the canonical form from the store

`test/support/canonical-json.ts` copies `scripts/canonical-json.ts` of the store at the tag `v0.7.0+oscal.1.2.3`. The
archive does not hold that file, so the copy cites the tag and the path. The module applies the steps of
`docs/canonical-json.md`:

1. It scans the JSON text and rejects a duplicate key in one object. `JSON.parse` keeps only the last value of a
   duplicate key, so the scan reads the text, not the parsed value.
2. It normalizes a value only when the value is a string and its key is in the datetime list of the document. A string
   that does not match the datetime grammar stays as it is.
3. It serializes with RFC 8785. It sorts keys by UTF-16 code units, and it writes strings and numbers with
   `JSON.stringify`, because RFC 8785 uses the ECMAScript serialization.
4. It encodes the result as UTF-8.

`test/canonical-json.test.ts` copies the cases of `scripts/check-canonical-json.ts` of the store at the same tag. It
also checks that each `expected/` file of the corpus is its own canonical form.

1. **Why:** the store module is the reference for the corpus check, and it is about 60 lines with no dependency. A copy
   gives the same comparison as the store.
2. **Alternative considered:** the npm package `canonicalize`. Rejected: it adds a dependency, it does not reject
   duplicate keys, and it does not normalize datetimes.

### D8: Keep the traceability record in `openspec/traceability.json`

The record path is the same as in the Python binding. At the start, the record is `{"format": 1, "operations": []}`.
`test/traceability.test.ts` checks three rules:

1. The record conforms to `openspec/traceability.schema.json` of the pinned artifact ([SRF-007]). Ajv in draft-07
   mode does the check.
2. Each identifier in the `requirements` field of an entry names an entry of `openspec/requirements.json` of the pinned
   artifact ([SRF-004]). The `binding-local` field names a requirement of this repo, so this check does not read it.
3. Each operation name occurs in one entry only ([SRF-003]).

A generated model type needs no entry, because [SRF-001] exempts it. The Python binding applies the same exemption.

1. **Why:** the record exists before the first export. The first change that exports an operation then adds one entry
   and needs no new test file.

## Risks / Trade-offs

1. [The npm registry published OpenSpec `1.17.0` on 2026-11-09, the day this change starts] → `mise.lock` records
   its checksum. If the CLI fails `openspec validate --all --strict` on this repo, the pin goes back to `1.16.1`,
   and the design records the reason.
2. [`tsx` `4.23.15` or TypeScript `7.0.2` fails on Node 26] → The check gate shows it. The store uses the same pins of
   Node, TypeScript, and `tsx`, so the risk is low.
3. [A defect in the runner shows as a binding failure in a later change] → D6 tests each check of the runner before
   any case leaves the list.

## Migration Plan

1. Implement the tasks on a feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.
3. Merge the pull request.

**Rollback:** revert the merge commit. No other repo depends on this one.

[PRS-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-001-parse-an-oscal-document-from-text-or-bytes
[PRS-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-002-parse-an-oscal-document-from-a-file-path
[PRS-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-003-typed-parsers-return-the-matching-document-type-or-report-a-type-mismatch
[ERR-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-002-a-non-raising-validity-check-is-available
[ELV-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-001-validate-a-standalone-element-against-a-named-type
[FAC-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-004-the-assessment-period-accessor-is-restricted-to-assessment-plan-and-assessment-results
[YML-005]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-005-parse-an-oscal-document-from-yaml-text-or-bytes
[YML-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-008-serialize-an-oscal-document-to-yaml
[VER-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/schema-versioning/spec.md#requirement-ver-007-each-binding-keeps-its-own-expected-conformance-failures
[SRF-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-001-a-binding-exposes-only-operations-that-a-requirement-defines
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
[SRF-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-004-contract-identifiers-in-a-traceability-record-resolve-in-the-requirement-index
[SRF-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-007-the-store-publishes-a-json-schema-for-the-traceability-record
