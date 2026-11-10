## 1. Toolchain

- [x] 1.1 Set Node `26.13.0` and the OpenSpec CLI `1.17.0` in `mise.toml`, run `mise lock`, and remove the old
      sidecar directory of OpenSpec `1.13.0` (design D1). Verify: `mise install --locked` succeeds, and
      `node --version` and `openspec --version` print the new versions.
- [x] 1.2 Set `engines.node` to `26.13.0` and `@types/node` to `26.6.6` in `package.json`, then run `npm install`.
      Verify: `npm ci` succeeds, and `npm run typecheck` passes.

## 2. Spec artifact pin

- [x] 2.1 Set the version `0.7.0+oscal.1.2.3` and the sha256
      `39f61f5c40200882106d9df6367d5aa5ccc6d604288741a8a70e93e119fa933e` in `scripts/spec-artifact.ts`. Change the
      member list and `artifactPaths()` as design D2 states. Verify: `npm run artifact` prints a cache directory that
      holds `corpus/1.2.3/cases.json`, `openspec/requirements.json`, and `openspec/traceability.schema.json`, and
      `test/spec-artifact.test.ts` passes.
- [x] 2.2 Run `npm run generate`. Verify: `git diff src/generated/oscal.ts` shows only the version in the header
      comment, and `npm run generate:check`, `npm run fixtures`, and `npm run types:check` pass.

## 3. Canonical JSON

- [x] 3.1 Add `test/support/canonical-json.ts` as a copy of `scripts/canonical-json.ts` of the store at the tag
      `v0.7.0+oscal.1.2.3` (design D7). Add `test/canonical-json.test.ts` with the cases of
      `scripts/check-canonical-json.ts` at the same tag. Verify: `test/canonical-json.test.ts` passes.
- [x] 3.2 In `test/canonical-json.test.ts`, test that each file in `corpus/1.2.3/expected/` of the pinned artifact is
      its own canonical form. Verify: the test passes.

## 4. Conformance runner

- [x] 4.1 Add `test/support/adapter.ts` with the functions of design D4. Each function throws `NotImplemented`.
      Verify: `npm run typecheck` passes.
- [x] 4.2 Add `test/support/runner.ts`, which applies the checks of design D4 for each corpus operation and the three
      rules of design D5. Add `test/runner.test.ts` with the fake adapters of design D6. Verify:
      `test/runner.test.ts` passes, each case passes with the conforming fake adapter, and each changed answer makes
      its case fail.
- [x] 4.3 Add `test/conformance/expected-failures.json` with each case id and the reason `not implemented`, and add
      `test/conformance.test.ts` (design D3). Verify: `npm test` passes, and each of the 58 cases fails with
      `NotImplemented` before the runner counts it as an expected failure.

## 5. Traceability record

- [x] 5.1 Add `openspec/traceability.json` with `{"format": 1, "operations": []}` and `test/traceability.test.ts` with
      the three checks of design D8. Verify: the test passes. Verify each check with a sample record that breaks it:
      a scenario identifier, an identifier that is not in the index, an entry with both a `requirements` field and a
      `binding-local` field, and a name in two entries.

## 6. Documentation and gate

- [x] 6.1 Update the README: the new pin, the conformance runner, the list of expected failures, and the traceability
      record. Verify: each link in the README resolves.
- [x] 6.2 Run `npm run check`. Verify: each step passes, including `openspec validate --all --strict` with OpenSpec
      `1.17.0`.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request.
