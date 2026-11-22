## 1. The manifest

- [x] 1.1 Add `manifest/${OSCAL_RELEASE}/constraints.json` and `manifest/constraints.schema.json` to `MEMBERS` in
      `scripts/spec-artifact.ts` (design D7). Add a short hash of `MEMBERS` to the name of the cache folder (design D7a).
      Add a test to `test/spec-artifact.test.ts` for a complete cache folder that was built with another list of members.
      Verify: `npx tsx --test test/spec-artifact.test.ts` passes, and a call of `ensureSpecArtifact` on a machine with
      the old cache gives a folder that holds both files.
- [x] 1.2 In `scripts/generate.ts`, check the manifest against its JSON Schema, check that `format` is 1 and that
      `oscal-release` is the release of the pin, and write the bytes of the manifest to `src/generated/constraints.json`.
      Run `npm run generate`. Add tests to `test/generate.test.ts` for a manifest that breaks each of the three checks.
      Verify: `npx tsx --test test/generate.test.ts` and `npm run generate:check` pass.

## 2. The evaluator

- [x] 2.1 Port the query compiler of `tmp/cns-spike/fast.ts` to `src/constraints.ts` (design D2). Add tests 1 and 2 of design D11 to
      `test/constraints.test.ts`. Verify: `npx tsx --test test/constraints.test.ts` passes, and the compiler throws for
      `$[0:2]`, `$..[*]` and `$[?length(@['a']) == 1]`.
- [x] 2.2 Port the walk of a document and the key index (design D3) and the rules of the entry kinds (design D4) to
      `src/constraints.ts`. Export one function that gives the failures of a value, each with the `id`, the JSON Pointer
      and the key. Verify: `npm run typecheck` passes, and the function gives no failure for each document of
      `documents/valid/` in the pinned corpus.
- [x] 2.3 Port the grouping of design D5. Save the failures of each document of `documents/` in the pinned corpus
      before the change. Verify: the failures after the change equal the saved failures, and
      `npx tsx --test test/constraints.test.ts` passes.
- [x] 2.4 Compare the evaluator with the evaluator of the store (design D2, Evidence). Use a checkout of the store at the
      tag `v0.9.0+oscal.1.2.3` in a temporary directory outside both repos, and run `npm ci` in it, because its
      evaluator imports `json-p3`. Run both evaluators on each JSON document
      of `corpus/1.2.3/documents/`, and on the SP 800-53 catalog of `usnistgov/oscal-content` with a few injected
      faults. Verify: for each document, both evaluators give the same entries, locations and keys. The median of
      40 warm runs of the evaluator of the binding takes 100 ms or less on the catalog. Put the warm median and the time
      of the first call in the pull request description. Put the document count and the timings in the pull request
      description.

## 3. The parse operations

- [x] 3.1 Add the optional field `constraint` to `FailureEntry` in `src/errors.ts`. Run the manifest check in
      `parseInput` and in `isValid` after the fail-fast schema check (design D1, D6). Add tests 3 to 5 of design D11 to
      `test/constraints.test.ts`. Verify: `npx tsx --test test/constraints.test.ts test/parse.test.ts` passes, and
      `npm run typecheck` passes.
- [x] 3.2 Check that the failure entries of a schema failure have no `constraint`, and that the typed parsers, `parseFile`,
      `parseYaml` and `parseYamlFile` give the same constraint failures as `parse`. Change the test "YML-009.01 an alias is read at its own location" in
      `test/yaml.test.ts` as design D11 states. Verify: `npx tsx --test test/parse.test.ts test/yaml.test.ts` passes.

## 4. The conformance runner

- [x] 4.1 Add `expected-constraints` to the `Case` type. Add `constraintIds` and `limitOf` to the `Adapter` interface
      and to the adapter. Add the step of design D8 to the `parse` rule of `runCase`. Verify: `npm run typecheck`
      passes.
- [x] 4.2 Change the conforming fake adapter and add the self-tests of design D9. Verify:
      `npx tsx --test test/runner.test.ts` passes, and the answers of design D9 item 2.1 to 2.3 each make their case
      fail.

## 5. The expected failures

- [x] 5.1 Remove the 236 entries of #66 from `test/conformance/expected-failures.json`. Verify: the file has the four
      entries of #67 and #68, and `npx tsx --test test/conformance.test.ts` passes.
- [x] 5.2 Run the whole test suite. Verify: `npm test` passes, and the output shows no skipped case except the cases of
      `yaml-parse-typed`.

## 6. Documentation and numbers

- [x] 6.1 Add the requirements of this change to `openspec/traceability.json`: PRS-015, CNS-006, CNS-007, CNS-008 and
      CNS-010 to CNS-017, CNS-024 and CNS-025 for `parse`, `parseYaml` and `parseYamlFile`, and PRS-015 for `isValid`.
      Verify: `npx tsx --test test/traceability.test.ts` passes.
- [x] 6.2 Update `README.md`, `docs/limits.md`, `docs/security.md`, `DEVELOPING.md` and the comments of `FailureEntry`,
      `ParseError` and `BuilderError` in `src/errors.ts` (design D12 items 1 to 3). Verify: `README.md` states that a
      parse rejects a document that breaks an OSCAL constraint. `docs/limits.md` and the comments in `src/errors.ts` no
      longer state one entry for each failing location without the constraint failures. `docs/security.md` states the
      cost of the manifest check. `DEVELOPING.md` names the manifest as an input of `npm run generate`.
- [x] 6.3 Run `npm run bench` and replace the numbers in `PERFORMANCE.md`. Verify: the file names the pinned release
      `0.9.0+oscal.1.2.3`, and the parse of a document of 22 KiB or less takes less than 1 ms.

## 7. Gate

- [x] 7.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #66.
