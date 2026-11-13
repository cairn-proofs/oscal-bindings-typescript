## Why

This change closes #37 and #29. The binding pins contract release `v0.8.0+oscal.1.2.3` since #38. That release adds
[PRS-014], [NAM-020], and [ERR-012]. The binding does not meet these requirements yet:

1. A parse error reports the failures of each branch of a nested union, also when the object selects one branch.
   [PRS-014] permits only the failures of the selected branch. The corpus case `parse/closed-enum-out-of-set` gives 3
   entries, and the case permits 1.
2. `parseFile` throws the Node error unchanged when it cannot read a path that exists, for example a directory. That
   error is not an `OscalError`, and for a directory its message and its `path` field do not name the path. [ERR-012]
   requires the read-error category of [ERR-001] and an error that names the path.

## What Changes

1. **BREAKING:** A parse error that comes from the schema check reports only the failures of the selected branch for an
   object that selects a nested-union branch ([PRS-014]). An object selects a branch when it holds the distinguishing
   property of exactly one branch ([NAM-020]). For each other object, the entries do not change. `parse`, `parseFile`,
   the typed parsers, and `OscalDoc` get this behavior. The entries of `validateElement` do not change.
2. **BREAKING:** `parseFile` throws a new `ReadError` when it cannot read a path that exists. The error is in the
   read-error category, and it is not a `ParseError` and not a `NotFoundError` ([ERR-012]). Its `path` property and its
   message name the path. Its `cause` property holds the Node error. A path that does not exist continues to give a
   `NotFoundError` ([ERR-006]).
3. `README.md` documents `ReadError`. The security note "Error text" names `ReadError.path` and the Node error in
   `cause`.
4. Tests cover scenarios PRS-014.01, NAM-020.01, ERR-012.01, ERR-012.02, and ERR-012.03.
5. The conformance runner runs the cases `parse/closed-enum-out-of-set` and `parse-file/directory`.
6. The traceability record names the new requirements ([SRF-003]).

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the document-parsing, naming-manifest, and error-model
capabilities, and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `scripts/generate.ts`, `src/generated/element-types.ts`, `src/validators.ts`, `src/parse.ts`,
   `src/errors.ts`, `test/parse.test.ts`, `test/validators.test.ts`, `test/security-notes.test.ts`,
   `test/conformance/expected-failures.json`, `openspec/traceability.json`, and `README.md`.
2. No new dependency.
3. No consumer depends on this repo, so the breaking changes of What Changes items 1 and 2 break no consumer.

[ERR-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-001-error-situations-map-to-a-fixed-taxonomy
[ERR-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-006-a-missing-file-is-a-not-found-error
[ERR-012]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-012-a-path-that-cannot-be-read-is-a-read-error
[NAM-020]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-020-a-distinguishing-property-identifies-a-branch-only-when-an-object-holds-it
[PRS-014]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-014-a-distinguishing-property-selects-the-nested-union-branch-of-parse-failures
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
