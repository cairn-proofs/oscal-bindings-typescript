## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `scripts/spec-artifact.ts` holds the version and the sha256 of the pin. `spec-pin.json` holds the version for the
   README badge, and `test/spec-pin.test.ts` fails when the two differ. `DEVELOPING.md` names the pinned release.
2. The archive of the new release passes `shasum -a 256 -c SHA256SUMS` and `gh release verify-asset`.
   `gh attestation verify` exits with 0.
3. `test/conformance.test.ts` runs each corpus case as one test through `runWithExpectation` of
   `test/support/runner.ts`. A listed case that passes fails the run, and so does a listed id that is not in the corpus.
4. These unit tests read corpus cases directly, and `expected-failures.json` does not apply to them:
   1. `test/parse.test.ts`: the inputs of the `round-trip` cases and of the `parse` cases.
   2. `test/document.test.ts`: the inputs of the `round-trip` cases.
   3. `test/serialize.test.ts`: the inputs of the `round-trip` cases. It parses them when the file loads, so one
      failure fails the file.
   4. `test/validators.test.ts`: the `validate-element` cases with `expected-valid`.
5. `runCase` gives the input of a `round-trip` case to the generic parser, the typed parser and the validity check in
   the same form. It does not apply the `path` form. In `yaml-round-trip`, it does not apply the `path` form, and the
   second parse always gets text. It does not read `expected-absent-keys`.
6. `parseYamlFile` exists, and the `Adapter` interface has no function for it. The binding has no typed YAML parser.
7. `reports` in `test/support/runner.ts` checks only that the category of the error equals `expected-category`. The
   corpus README of the new release adds a rule for the category tree of [ERR-009]. The `Adapter` has no function to
   test a category. `DocumentTypeMismatchError` extends `ParseError`, and the other error classes have no parent
   class other than `OscalError`.
8. `.github/workflows/build.yml` has the job `tag-check`, which runs on a `v*` tag and fails when the tag is not
   `v<version>` or when the commit is not on `main`. The check gate passes when a listed case fails.
9. `test/canonical-json.test.ts` is a copy of the cases of `scripts/check-canonical-json.ts` of the store. The store
   adds four cases to that file in the new release. `scripts/canonical-json.ts` is the same file in both releases.
10. `test/runner.test.ts` runs each case that is not pending through a conforming fake adapter that answers from the
   corpus data. Then it changes one answer of the fake adapter, and checks that the case fails.

## Goals / Non-Goals

**Goals:**

1. `npm run check` passes on the new pin, and each corpus case either passes, is listed with its owner, or is skipped
   as the [corpus README] states.
2. The runner checks each rule of the [corpus README] that a passing case depends on, so that a case does not pass
   without its check.
3. A package that has a listed failure cannot be released, so the claim of `README.md` that the binding passes the
   corpus is true for each release.

**Non-Goals:**

1. The rule for `expected-constraints`. Only cases that #66 and #68 own carry the field, and each of those issues adds
   the rule for its operations.

## Decisions

### D1: The reason of a listed case is its owner

Each entry of `expected-failures.json` maps a case id to the issue that owns it:

1. `#66`: each `parse/constraint/*` case, `parse/allowed-value-case`, `parse/nested-control-part-name` and
   `parse/nested-control-part-name-three-levels`.
2. `#67`: `round-trip/email-forms`.
3. `#68`: `element/hash-wrong-length`, `build-hash/wrong-length` and `build-resource/duplicate-rlink-href`.

The list holds no other case. A case that fails for another reason is a defect of this change.

**Why:** the owner tells the reader where the fix is, and #66, #67 and #68 each remove their own entries.

### D2: The unit tests skip the listed cases

`test/support/runner.ts` exports the parsed `expected-failures.json` and a filter that removes each listed case from a
list of cases. `test/conformance.test.ts` and the four unit test files of [Context](#context) item 4 use them. Each
unit test file applies the filter to the cases that it reads, before it reads an input.

**Why:** [VER-007] gives the binding one record of its expected failures. When an issue removes an entry, the unit
tests cover the case again with no other change.

**Alternative:** a second list for the unit tests. Each fix would then change two lists, and the lists can differ.

### D3: Operations that the binding does not offer

`test/support/runner.ts` exports a map from each operation that the binding does not offer to its reason. The only
entry is `yaml-parse-typed`, with the reason that the binding offers no typed YAML parser ([YML-007]).
`test/conformance.test.ts` registers each case of such an operation as a skipped test, with the reason. The conforming
fake adapter of `test/runner.test.ts` does not run these cases.

**Why:** the [corpus README] tells the binding to skip the operation. A skipped test shows the case and the reason in
the test output. A listed case would state a failure that no change is planned to fix.

### D4: The `yaml-parse-file` rule

The `Adapter` interface adds `parseYamlFile(path: string): unknown`, and the adapter connects it to `parseYamlFile`.
The rule of `yaml-parse-file` is the rule of `parse-file` with `parseYamlFile`: the operation reports
`expected-category`, and the error message names the path.

### D5: An empty bound matches `null`

In the `Case` type, each bound of `expected-period` is `string | null`. For a `null` bound, the bound that the facade
returns must be `undefined` or `null`. For a datetime bound, the bound must be a string, and its normalized form must
equal the datetime, as now.

**Why:** the [corpus README] lets the binding choose the form of an empty bound. The runner accepts both forms, so the
conforming fake adapter can answer with the `null` of the corpus data.

### D6: The input forms of `round-trip` and `yaml-round-trip`

The rules follow the [input forms] of the corpus README:

1. `round-trip`: with `bytes`, the generic parser and the validity check get the bytes. With `path`, `parseFile` gets
   the path and takes the place of the generic parser, and the validity check gets the text. The typed parser gets the
   text for each form.
2. `yaml-round-trip`: with `bytes`, the first parse gets the bytes, and the second parse gets the UTF-8 bytes of the
   serialized YAML. With `path`, `parseYamlFile` gets the path of the input. The runner then writes the serialized YAML
   to a file in a new temporary directory, gives that path to `parseYamlFile`, and removes the directory. With no
   form, the second parse gets the serialized YAML as text, as now.

### D7: The `expected-absent-keys` rule

For a `yaml-round-trip` case with `expected-absent-keys`, the runner parses the serialized YAML with `parse` of the
`yaml` package, with no schema. No mapping at any depth may have a key in the list. A failure names the key.

**Why:** the binding already depends on `yaml`, and the [corpus README] lets the runner use any YAML reader.

### D8: The category tree

The `Adapter` interface adds `inCategory(error: unknown, category: Category): boolean`. The adapter answers with
`instanceof` of the error class of the category: `ParseError` for parse-error, `DocumentTypeMismatchError` for
document-type-mismatch, and the class of each other category. It throws for an error that is not an `OscalError`, as
`category` does.

`reports` in `test/support/runner.ts` keeps its check of `category`. It then reads `categories` from `cases.json` of the
corpus directory, and checks each category with `inCategory`. The result must be true for `expected-category` and for
its ancestor, and false for each other category. The only parent in the tree is parse-error, the parent of
document-type-mismatch, as the [corpus README] states. The runner holds this one parent entry, because the corpus does
not state the tree as data.

**Why:** the rule applies to each case with `expected-category`. The binding already meets it, so this check changes no
result, and it keeps each such case from passing without its check.

**Alternative:** a function that returns the ancestors of the category of an error. The runner then compares lists, and
the adapter has to know the tree, which is the data that the runner checks.

### D9: The release gate

The job `tag-check` of `.github/workflows/build.yml` gets a step that fails when `test/conformance/expected-failures.json`
has an entry. The step names the entries in its message, and it reads the file with `node -p`, as the step "Check the
tag" reads `package.json`. `DEVELOPING.md`, under "Release", states the rule.

**Why:** `README.md` states that the binding passes the conformance corpus. The statement describes a release, and
`main` holds listed failures from this change until #66, #67 and #68 have landed. A rule in the workflow makes the
statement true for each release with no work from the maintainer.

**Alternatives:** a rule in `DEVELOPING.md` only, which depends on a maintainer who remembers it. A new README sentence
for `main`, which states a development state that a release does not keep.

### D10: The canonical JSON copies

`test/canonical-json.test.ts` adds the four cases of `scripts/check-canonical-json.ts` at the new tag: two for
SER-004.02 and two for SER-004.03. The headers of `test/canonical-json.test.ts` and `test/support/canonical-json.ts`
name the new tag. The content of `test/support/canonical-json.ts` does not change, because the store file has the same
bytes in both releases.

### D11: Self-tests of the runner

`test/runner.test.ts` changes as follows:

1. The test of the `bytes` input form uses the first `parse` case with that form.
2. The conforming fake adapter changes as follows:
   1. It adds `parseYamlFile`.
   2. `parse`, `parseYaml`, `parseFile` and `parseYamlFile` return one marker document. The file parsers keep their
      throw for a `parse-file` or `yaml-parse-file` case. `parse` and `parseYaml` keep their throw for the failing
      cases that they have now.
   3. `serialize` returns the expected JSON for the marker document, and other bytes for each other value.
   4. It adds `inCategory`, which answers from the category of its `FakeError`: true for that category, true for
      parse-error when the category is document-type-mismatch, and false for each other category.
3. These changed answers each make their case fail:
   1. `yaml-parse-file`: no error, an error of another category, and a not-found error whose message lacks the path.
   2. `assessment-period/at-frequency-only`: a datetime for the start.
   3. `round-trip/catalog-path`: `parseFile` returns a document that is not the marker.
   4. `yaml-round-trip/profile-path`: `parseYamlFile` returns a document that is not the marker.
   5. `yaml-round-trip/minimal-catalog`: `serializeYaml` writes `remarks` with an empty value.
   6. A case of category parse-error, for example `parse/not-json`: `inCategory` gives true for document-type-mismatch.
   7. A case of category parse-error: `inCategory` gives false for parse-error.
   8. `parse-typed/wrong-document-type`: `inCategory` gives false for parse-error.
4. These tests record the arguments that the fake adapter gets, and check them:
   1. `round-trip/catalog-path` gives the path of the input to `parseFile`.
   2. `yaml-round-trip/profile-path` calls `parseYamlFile` twice. The first path is the path of the input. The second
      path is another path, and at the time of the call the file at that path holds the output of `serializeYaml`.
   3. `yaml-round-trip/catalog-bytes` gives a `Uint8Array` to both calls of `parseYaml`. The second one holds the UTF-8
      bytes of the output of `serializeYaml`.

## Risks / Trade-offs

1. [The unit tests do not cover a listed case until its owner removes the entry] → The conformance run still runs
   each listed case, and fails when the case passes. So the entry cannot stay in the list after the fix.
2. [The release gate blocks each release until #66, #67 and #68 have landed, which can be impractical] → The rule
   is one step in `tag-check`. The maintainer changes or removes the step when the rule proves impractical, and
   then restates the README claim.

[corpus README]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/corpus/1.2.3/README.md#operation-list
[ERR-009]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/error-model/spec.md#requirement-err-009-error-categories-form-a-tree
[input forms]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/corpus/1.2.3/README.md#input-forms
[VER-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/schema-versioning/spec.md#requirement-ver-007-each-binding-keeps-its-own-expected-conformance-failures
[YML-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/yaml-documents/spec.md#requirement-yml-007-a-typed-yaml-parser-behaves-as-a-typed-json-parser
