## 1. Union-site table

- [x] 1.1 In `scripts/generate.ts`, write the `UnionSite` interface and the `unionSites` export of design D1 into
      `src/generated/element-types.ts`, one row for each site of each `union` entry, with the variants in manifest
      order. Run `npm run generate`. Verify: `unionSites` has 13 rows, the `Parameter` row lists `select` with
      `ParameterWithSelect` and `values` with `ParameterWithValues`, and `npm run generate:check` and
      `test/generate.test.ts` pass.

## 2. Selected-branch failures

- [x] 2.1 In `src/validators.ts`, set `verbose: true` in the Ajv factory, and build the map from site node to variants
      of design D2 at load. Update the doc comment of the factory. Add `passes` of design D2, and call it for the
      fail-fast calls in `src/parse.ts` and `src/validate-element.ts`. Make `collect` set `errors` to `null` after it
      reads them. Verify: `npm run typecheck` and `npm test` pass, and `grep -n "failFast(" src` finds only calls
      through `passes`.
- [x] 2.2 In `src/validators.ts`, split `collect` into `toEntries` and `collect`, and add `selectedErrors` and
      `collectSelected` of design D3. Change the parse pipeline in `src/parse.ts` to call `collectSelected`.
      `src/validate-element.ts` continues to call `collect`. Verify: `npm run typecheck` passes.
- [x] 2.3 Add the tests of design D5 item 1 to `test/validators.test.ts`. Remove `parse/closed-enum-out-of-set` from
      `test/conformance/expected-failures.json`. Verify: `npm test` passes, each new test name starts with its scenario
      identifier where it has one, and each corpus case with `expected-min-failures` or `expected-max-failures` passes.
- [x] 2.4 In the security note "Size and time" of `README.md`, replace "The binding checks it twice" with the cost of
      design Risk 2: the binding validates an invalid document again for each nested union that selects a branch above a
      failure, and a deep stack of groups multiplies the cost. Verify: the note names `CatalogGroup` and
      `ProfileGroup`, and `test/security-notes.test.ts` passes.
- [x] 2.5 Add PRS-014 to `parse` and to each typed parser in `openspec/traceability.json`. Verify:
      `test/traceability.test.ts` passes.

## 3. Read error

- [x] 3.1 In `src/errors.ts`, add `read-error` to `ErrorCategory`, add `ReadError` of design D4, and remove the
      exception for a file read error from the header comment. In `src/parse.ts`, throw a `ReadError` for each read
      error other than `ENOENT`, `ENOTDIR`, and a `TypeError` (design D4), and update the doc comment of
      `parseFile`. Verify: `npm run typecheck` passes.
- [x] 3.2 Replace the directory test in `test/parse.test.ts` with the tests of design D5 item 2. Remove
      `parse-file/directory` from `test/conformance/expected-failures.json`. Verify: `npm test` passes, and the test of
      ERR-012.02 runs when the tests do not run as root.
- [x] 3.3 In `README.md`, add `ReadError` to the error-model item of `## Status`, and change the security note "Error
      text" to name `ReadError.path` and the Node error in `cause`. Change the "Error text" test in
      `test/security-notes.test.ts` as design D5 item 3 states, and add `ReadError` to the exported names in the notes
      test. Verify: `test/security-notes.test.ts` passes.
- [x] 3.4 Add ERR-012 to `parseFile` in `openspec/traceability.json`. Verify: `test/traceability.test.ts` passes.

## 4. Gate

- [x] 4.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #37 and #29.
